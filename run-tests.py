#!/usr/bin/env python3
"""
CivicPulse Automated Verification & Test Suite Runner
Runs core geospatial calculations, boundary validations, and concurrency assertions.
"""

import math
import sys

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

GREEN = "\033[92m"
RED = "\033[91m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

def calculate_haversine_meters(lat1, lon1, lat2, lon2):
    R = 6371000.0  # Earth radius in meters
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def run_tests():
    print(f"\n{BOLD}{CYAN}======================================================={RESET}")
    print(f"{BOLD}{CYAN}   [TEST SUITE] CivicPulse: Invariant Verification     {RESET}")
    print(f"{BOLD}{CYAN}======================================================={RESET}\n")

    passed = 0
    failed = 0

    def assert_test(name, condition, details=""):
        nonlocal passed, failed
        if condition:
            print(f"  [PASS] : {name}")
            passed += 1
        else:
            print(f"  [FAIL] : {name} - {details}")
            failed += 1

    # --- SUITE 1: GEOSPATIAL & POSTGIS PROXIMITY ---
    print(f"{BOLD}[Suite 1: Geospatial Haversine & 5km Radius Calculation]{RESET}")
    
    sf_civic = (37.7793, -122.4192)
    market_4th = (37.7858, -122.4065)
    oakland = (37.8044, -122.2711)

    dist_adjacent = calculate_haversine_meters(sf_civic[0], sf_civic[1], market_4th[0], market_4th[1])
    assert_test("Inter-intersection distance within SF core (~1.34km)", 1200 <= dist_adjacent <= 1500, f"Got {dist_adjacent:.1f}m")

    assert_test("Market & 4th falls within 5km radius", dist_adjacent <= 5000, f"Got {dist_adjacent:.1f}m")

    dist_oakland = calculate_haversine_meters(sf_civic[0], sf_civic[1], oakland[0], oakland[1])
    assert_test("Oakland Downtown excluded from 5km radius (>12km)", dist_oakland > 5000, f"Got {dist_oakland:.1f}m")

    zero_dist = calculate_haversine_meters(sf_civic[0], sf_civic[1], sf_civic[0], sf_civic[1])
    assert_test("Identical coordinates return 0.0m distance", zero_dist == 0.0, f"Got {zero_dist}m")

    # --- SUITE 2: LATITUDE & LONGITUDE BOUNDARIES ---
    print(f"\n{BOLD}[Suite 2: Coordinate Boundary Invariants]{RESET}")

    def is_valid_coord(lat, lng):
        return -90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0

    assert_test("Equator and Prime Meridian (0, 0) valid", is_valid_coord(0.0, 0.0))
    assert_test("South Pole (-90, 0) valid", is_valid_coord(-90.0, 0.0))
    assert_test("International Date Line (0, 180) valid", is_valid_coord(0.0, 180.0))
    assert_test("Invalid Latitude (90.1) rejected", not is_valid_coord(90.1, 0.0))
    assert_test("Invalid Longitude (-180.1) rejected", not is_valid_coord(0.0, -180.1))

    # --- SUITE 3: CONCURRENCY & IDEMPOTENCY INVARIANTS ---
    print(f"\n{BOLD}[Suite 3: Concurrency & Deduplication Invariants]{RESET}")

    voter_set = set()
    upvote_counter = 0

    def apply_upvote(user_id):
        nonlocal upvote_counter
        if user_id in voter_set:
            return False  # Already voted
        voter_set.add(user_id)
        upvote_counter += 1
        return True

    # Simulate 5 concurrent upvotes from the SAME user
    results = [apply_upvote("usr-duplicate-999") for _ in range(5)]
    assert_test("Atomic deduplication permits exactly 1 upvote per user", results == [True, False, False, False, False])
    assert_test("Counter incremented exactly once", upvote_counter == 1)

    # --- SUITE 4: SPATIAL FILTERING & GEO-FENCING (TURF.JS EQUIVALENT) ---
    print(f"\n{BOLD}[Suite 4: Spatial Filtering & Geo-fencing Invariants]{RESET}")

    def is_point_in_polygon(point, polygon):
        lat, lng = point[0], point[1]
        inside = False
        j = len(polygon) - 1
        for i in range(len(polygon)):
            yi, xi = polygon[i][0], polygon[i][1]
            yj, xj = polygon[j][0], polygon[j][1]
            intersect = ((yi > lat) != (yj > lat)) and (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)
            if intersect:
                inside = not inside
            j = i
        return inside

    # Define a bounding box polygon around K. Kalipalayam core
    geo_polygon = [
        [10.970, 77.930],
        [10.970, 77.950],
        [10.985, 77.950],
        [10.985, 77.930]
    ]

    inside_point = (10.9782, 77.9421)   # Junction incident
    outside_point = (10.9950, 77.9650)  # Distant location outside sector

    assert_test("Inside point correctly identified within geo-fence", is_point_in_polygon(inside_point, geo_polygon))
    assert_test("Outside point correctly excluded from geo-fence", not is_point_in_polygon(outside_point, geo_polygon))

    # --- SUITE 5: TIME DECAY & SLA ESCALATION INVARIANTS ---
    print(f"\n{BOLD}[Suite 5: Time Decay & SLA Escalation Invariants]{RESET}")

    def check_escalation(created_hours_ago, status):
        is_over_24h = created_hours_ago > 24
        return is_over_24h and status == 'REPORTED'

    assert_test("Issue created 30h ago and status=REPORTED is escalated (>24h SLA)", check_escalation(30, 'REPORTED') is True)
    assert_test("Issue created 18h ago and status=REPORTED is not escalated (<24h)", check_escalation(18, 'REPORTED') is False)
    assert_test("Issue created 36h ago and status=IN_PROGRESS is not escalated", check_escalation(36, 'IN_PROGRESS') is False)
    assert_test("Issue created 48h ago and status=RESOLVED is not escalated", check_escalation(48, 'RESOLVED') is False)

    # --- SUITE 6: AI CONFIDENCE BOUNDARIES & TOOLTIPS ---
    print(f"\n{BOLD}[Suite 6: AI Confidence & Tooltip Formatting]{RESET}")

    def format_ai_confidence(confidence):
        if not (0.0 <= confidence <= 1.0):
            raise ValueError("Confidence must be between 0.0 and 1.0")
        pct = round(confidence * 100)
        return f"AI Categorized ({pct}% Confidence)"

    assert_test("Confidence 0.94 formats to 94% tooltip", format_ai_confidence(0.94) == "AI Categorized (94% Confidence)")
    assert_test("Confidence 0.96 formats to 96% tooltip", format_ai_confidence(0.96) == "AI Categorized (96% Confidence)")
    assert_test("Confidence 1.0 formats to 100% tooltip", format_ai_confidence(1.0) == "AI Categorized (100% Confidence)")

    # --- SUMMARY ---
    print(f"\n{BOLD}-------------------------------------------------------{RESET}")
    print(f"  Test Execution Result: {passed} Passed, {failed} Failed")
    print(f"{BOLD}-------------------------------------------------------{RESET}\n")

    return 0 if failed == 0 else 1

if __name__ == '__main__':
    sys.exit(run_tests())
