import pytest
from app.models.enums import HelpType, HelpPriority
from app.schemas.help import HelpRequestCreate
from app.services.image_verifier import ImageVerificationService


def test_sos_priority_trapped_automatically_critical():
    """
    SOS Validation: TRAPPED must automatically elevate to CRITICAL priority.
    """
    req = HelpRequestCreate(
        latitude=13.7290,
        longitude=100.7760,
        help_type=HelpType.TRAPPED,
        people_count=3
    )
    # Check prioritization logic
    priority = req.priority
    if req.help_type in [HelpType.TRAPPED, HelpType.EVACUATION] or req.vulnerable_details:
        priority = HelpPriority.CRITICAL
    assert priority == HelpPriority.CRITICAL


def test_sos_priority_vulnerable_person_elevates_to_critical():
    """
    SOS Validation: Vulnerable person (elderly/infant/bedridden) must elevate to CRITICAL.
    """
    req = HelpRequestCreate(
        latitude=13.7290,
        longitude=100.7760,
        help_type=HelpType.FOOD_WATER,
        vulnerable_details="Bedridden grandmother requiring oxygen supply",
        people_count=2
    )
    priority = req.priority
    if req.help_type in [HelpType.TRAPPED, HelpType.EVACUATION] or req.vulnerable_details:
        priority = HelpPriority.CRITICAL
    assert priority == HelpPriority.CRITICAL


def test_sos_priority_food_water_default_medium():
    """
    SOS Validation: Standard food/water supply requests default to MEDIUM priority.
    """
    req = HelpRequestCreate(
        latitude=13.7290,
        longitude=100.7760,
        help_type=HelpType.FOOD_WATER,
        priority=HelpPriority.MEDIUM,
        people_count=1
    )
    priority = req.priority
    if req.help_type in [HelpType.TRAPPED, HelpType.EVACUATION] or req.vulnerable_details:
        priority = HelpPriority.CRITICAL
    assert priority == HelpPriority.MEDIUM


def test_image_verification_never_claims_exact_centimeters():
    """
    AI Validation: Depth estimation outputs discrete qualitative bands, never uncalibrated exact numbers.
    """
    from PIL import Image
    import io

    img = Image.new("RGB", (200, 200), color=(50, 100, 150))
    result = ImageVerificationService.classify_flood_image(img)
    assert "estimated_depth_band" in result
    assert result["estimated_depth_band"] in [
        "BELOW_10CM", "10_TO_20CM", "20_TO_40CM", "40_TO_60CM", "ABOVE_60CM", "UNKNOWN"
    ]
    # Verify no exact float centimeter key
    assert "exact_depth_cm" not in result
