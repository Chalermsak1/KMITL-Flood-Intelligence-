import io
import pytest
from PIL import Image, ImageDraw
from app.services.image_verifier import ImageVerificationService


def create_test_image(width=400, height=300, color=(100, 150, 200), format="JPEG"):
    img = Image.new("RGB", (width, height), color=color)
    draw = ImageDraw.Draw(img)
    draw.rectangle([50, 50, 350, 250], fill=(50, 100, 150))
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue(), img


def test_magic_bytes_validation():
    # Valid JPEG
    jpeg_bytes, _ = create_test_image(format="JPEG")
    valid, mime = ImageVerificationService.validate_magic_bytes(jpeg_bytes)
    assert valid is True
    assert mime == "image/jpeg"

    # Valid PNG
    png_bytes, _ = create_test_image(format="PNG")
    valid, mime = ImageVerificationService.validate_magic_bytes(png_bytes)
    assert valid is True
    assert mime == "image/png"

    # Invalid: arbitrary text file
    fake_bytes = b"Hello world this is not an image"
    valid, err = ImageVerificationService.validate_magic_bytes(fake_bytes)
    assert valid is False
    assert "Unsupported file format" in err

    # Too large
    huge_bytes = b"\xFF\xD8\xFF" + b"\x00" * (6 * 1024 * 1024)
    valid, err = ImageVerificationService.validate_magic_bytes(huge_bytes)
    assert valid is False
    assert "exceeds maximum permitted size" in err


def test_image_quality_assessment():
    # Good quality image
    _, good_img = create_test_image(width=500, height=400)
    quality = ImageVerificationService.assess_image_quality(good_img)
    assert quality["status"] in ["GOOD", "LOW_QUALITY"]
    assert "dimensions" in quality

    # Very dark image
    dark_img = Image.new("RGB", (300, 300), color=(5, 5, 5))
    dark_quality = ImageVerificationService.assess_image_quality(dark_img)
    assert dark_quality["status"] == "LOW_QUALITY"
    assert "dark" in dark_quality["reason"].lower()

    # Low resolution image (<200px)
    tiny_img = Image.new("RGB", (150, 150), color=(128, 128, 128))
    tiny_quality = ImageVerificationService.assess_image_quality(tiny_img)
    assert tiny_quality["status"] == "INVALID"
    assert "small" in tiny_quality["reason"].lower()


def test_perceptual_hashing_and_duplicate_detection():
    _, img1 = create_test_image(width=400, height=300, color=(120, 140, 160))
    # Same image slightly resized
    img2 = img1.resize((390, 290)).resize((400, 300))

    hash1 = ImageVerificationService.compute_perceptual_hash(img1)
    hash2 = ImageVerificationService.compute_perceptual_hash(img2)

    assert len(hash1) == 16  # 64-bit hex
    assert len(hash2) == 16
    
    distance = ImageVerificationService.hamming_distance(hash1, hash2)
    assert distance <= 8  # Similar images have small hamming distance

    # Completely different image
    diff_img = Image.new("RGB", (400, 300), color=(255, 0, 0))
    draw = ImageDraw.Draw(diff_img)
    draw.line([(0, 0), (400, 300)], fill=(0, 255, 0), width=10)
    hash_diff = ImageVerificationService.compute_perceptual_hash(diff_img)
    
    dist_diff = ImageVerificationService.hamming_distance(hash1, hash_diff)
    assert dist_diff > 10


def test_ai_flood_inference_and_depth_bands():
    _, img = create_test_image(width=400, height=300, color=(30, 80, 120))
    result = ImageVerificationService.classify_flood_image(img)

    assert isinstance(result["is_flood_related"], bool)
    assert isinstance(result["water_visible"], bool)
    assert isinstance(result["is_road_or_street"], bool)
    assert result["estimated_depth_band"] in [
        "BELOW_10CM",
        "10_TO_20CM",
        "20_TO_40CM",
        "40_TO_60CM",
        "ABOVE_60CM",
        "UNKNOWN",
    ]
    # Mandatory disclaimer present
    assert "AI Estimate" in result["disclaimer"]
    assert "Not an in-situ physical measurement" in result["disclaimer"]


def test_report_confidence_calculation():
    # Fresh report with good photo, high corroboration, no duplicates
    conf_high = ImageVerificationService.calculate_overall_confidence(
        recency_minutes=10,
        nearby_reports_count=4,
        has_photo=True,
        image_quality_status="GOOD",
        ai_confidence=0.88,
        is_duplicate=False
    )
    assert conf_high == "HIGH"

    # Stale, duplicate, low quality report
    conf_low = ImageVerificationService.calculate_overall_confidence(
        recency_minutes=180,
        nearby_reports_count=0,
        has_photo=True,
        image_quality_status="LOW_QUALITY",
        ai_confidence=0.4,
        is_duplicate=True
    )
    assert conf_low == "LOW"
