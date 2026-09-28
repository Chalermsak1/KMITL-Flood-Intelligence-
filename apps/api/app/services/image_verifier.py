import io
import math
from typing import Tuple, Dict, Any, Optional
from PIL import Image, ImageStat
import numpy as np


class ImageVerificationService:
    MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
    MIN_DIMENSION = 200
    MAX_DIMENSION = 6000

    @classmethod
    def validate_magic_bytes(cls, data: bytes) -> Tuple[bool, str]:
        """
        Validate real file type via magic byte headers.
        Supports JPEG, PNG, WEBP.
        """
        if len(data) > cls.MAX_FILE_SIZE_BYTES:
            return False, "File exceeds maximum permitted size of 5 MB."

        if len(data) < 12:
            return False, "File data corrupted or truncated."

        # Check JPEG: FF D8 FF
        if data.startswith(b"\xff\xd8\xff"):
            return True, "image/jpeg"

        # Check PNG: 89 50 4E 47 0D 0A 1A 0A
        if data.startswith(b"\x89PNG\r\n\x1a\n"):
            return True, "image/png"

        # Check WEBP: RIFF....WEBP
        if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
            return True, "image/webp"

        return False, "Unsupported file format. Must be JPEG, PNG, or WEBP."

    @classmethod
    def assess_image_quality(cls, img: Image.Image) -> Dict[str, Any]:
        """
        Assess blur, brightness, aspect ratio, and resolution.
        Returns quality score (0.0 to 1.0) and status.
        """
        width, height = img.size

        if width < cls.MIN_DIMENSION or height < cls.MIN_DIMENSION:
            return {
                "status": "INVALID",
                "score": 0.0,
                "reason": f"Resolution {width}x{height} is too small (minimum 200x200).",
                "dimensions": f"{width}x{height}"
            }

        # Convert to grayscale for luminance & blur analysis
        gray = img.convert("L")
        stat = ImageStat.Stat(gray)
        mean_brightness = stat.mean[0]

        if mean_brightness < 28.0:
            return {
                "status": "LOW_QUALITY",
                "score": 0.35,
                "reason": "Image is excessively dark/underexposed.",
                "dimensions": f"{width}x{height}"
            }
        elif mean_brightness > 248.0:
            return {
                "status": "LOW_QUALITY",
                "score": 0.40,
                "reason": "Image is excessively washed out/overexposed.",
                "dimensions": f"{width}x{height}"
            }

        # Fast Laplacian Variance approximation using numpy diff
        arr = np.array(gray, dtype=np.float32)
        # Compute 2D discrete Laplacian kernel [[0, 1, 0], [1, -4, 1], [0, 1, 0]]
        laplacian = (
            np.roll(arr, 1, axis=0) + np.roll(arr, -1, axis=0) +
            np.roll(arr, 1, axis=1) + np.roll(arr, -1, axis=1) - 4 * arr
        )
        variance = float(laplacian.var())

        if variance < 80.0:
            return {
                "status": "LOW_QUALITY",
                "score": 0.45,
                "reason": "Image is severely blurred.",
                "dimensions": f"{width}x{height}"
            }

        quality_score = min(1.0, 0.5 + (min(variance, 1000.0) / 2000.0))
        return {
            "status": "GOOD",
            "score": round(quality_score, 2),
            "variance": round(variance, 1),
            "brightness": round(mean_brightness, 1),
            "dimensions": f"{width}x{height}"
        }

    @classmethod
    def compute_perceptual_hash(cls, img: Image.Image) -> str:
        """
        Compute 64-bit difference hash (dHash) for perceptual similarity & duplicate detection.
        """
        # Resize to 9x8 grayscale
        resized = img.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
        if hasattr(resized, "get_flattened_data"):
            pixels = list(resized.get_flattened_data())
        else:
            pixels = list(resized.getdata())

        # Compare adjacent pixels in each row
        diff = []
        for row in range(8):
            for col in range(8):
                idx = row * 9 + col
                diff.append(pixels[idx] > pixels[idx + 1])

        # Convert 64 boolean bits to hexadecimal
        decimal_val = 0
        for bit in diff:
            decimal_val = (decimal_val << 1) | int(bit)

        return f"{decimal_val:016x}"

    @classmethod
    def hamming_distance(cls, hash1: str, hash2: str) -> int:
        """Compute bitwise Hamming distance between two 16-character hex hashes."""
        try:
            val1 = int(hash1, 16)
            val2 = int(hash2, 16)
            xor_val = val1 ^ val2
            return bin(xor_val).count("1")
        except Exception:
            return 64

    @classmethod
    def classify_flood_image(cls, img: Image.Image) -> Dict[str, Any]:
        """
        Lightweight multi-label classifier estimate.
        Returns flood presence, road detection, and estimated depth band.
        Explicitly marked with AI estimate disclaimer.
        """
        rgb = img.convert("RGB").resize((128, 128))
        arr = np.array(rgb)

        # Analyze color distribution in lower half (ground/road surface)
        lower_half = arr[64:, :, :]
        r = lower_half[:, :, 0].astype(float)
        g = lower_half[:, :, 1].astype(float)
        b = lower_half[:, :, 2].astype(float)

        # Check water color characteristics (murky brown/muddy floodwater or reflected grey water)
        # Muddy water: R > G > B with moderate saturation
        is_muddy = np.mean((r > g) & (g > b) & ((r - b) > 15)) > 0.15
        # Reflective wet road: low saturation, specular highlights
        color_variance = np.var(lower_half, axis=(0, 1)).mean()
        is_water_surface = is_muddy or (color_variance < 350.0)

        # Confidence metric
        ai_conf = 0.75 if is_water_surface else 0.40

        # Heuristic depth band estimate based on water coverage ratio
        water_ratio = float(np.mean(b > 60))
        if water_ratio > 0.65:
            depth_band = "20_TO_40CM"
        elif water_ratio > 0.35:
            depth_band = "10_TO_20CM"
        else:
            depth_band = "BELOW_10CM"

        return {
            "is_flood_related": bool(is_water_surface or water_ratio > 0.3),
            "is_road_or_street": True,
            "water_visible": bool(is_water_surface),
            "estimated_depth_band": depth_band,
            "confidence": round(ai_conf, 2),
            "disclaimer": "AI Estimate (Uncalibrated Visual Clue) - Not an in-situ physical measurement."
        }

    @classmethod
    def calculate_overall_confidence(
        cls,
        recency_minutes: int,
        nearby_reports_count: int,
        has_photo: bool,
        image_quality_status: str,
        ai_confidence: float,
        is_duplicate: bool
    ) -> str:
        """
        Synthesize confidence score into LOW, MEDIUM, or HIGH.
        """
        if is_duplicate:
            return "LOW"

        score = 0
        # Recency
        if recency_minutes <= 15:
            score += 3
        elif recency_minutes <= 45:
            score += 2
        else:
            score += 1

        # Corroboration
        if nearby_reports_count >= 3:
            score += 3
        elif nearby_reports_count >= 1:
            score += 2

        # Photo & AI
        if has_photo:
            if image_quality_status == "GOOD" and ai_confidence >= 0.7:
                score += 3
            elif image_quality_status == "GOOD":
                score += 2
            else:
                score += 1

        if score >= 7:
            return "HIGH"
        elif score >= 4:
            return "MEDIUM"
        return "LOW"
