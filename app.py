
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
import math

import joblib
import pandas as pd
import requests
from flask import Flask, jsonify, render_template, request


# ==========================================
# FLASK APPLICATION
# ==========================================

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "best_aqi_model.pkl"

model_bundle = joblib.load(MODEL_PATH)

model = model_bundle["model"]
features = list(model_bundle["features"])
model_name = model_bundle["model_name"]


# ==========================================
# INDIAN STATES AND UNION TERRITORIES
# ==========================================

INDIAN_STATES = [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Andaman and Nicobar Islands",
    "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Jammu and Kashmir",
    "Ladakh",
    "Lakshadweep",
    "Puducherry"
]


# ==========================================
# STATE-WISE DISTRICT DATA
# Starter directory, not exhaustive
# ==========================================

DISTRICTS_BY_STATE = {

    "Madhya Pradesh": [
        "Agar Malwa", "Alirajpur", "Anuppur",
        "Ashoknagar", "Balaghat", "Barwani",
        "Betul", "Bhind", "Bhopal", "Burhanpur",
        "Chhatarpur", "Chhindwara", "Damoh",
        "Datia", "Dewas", "Dhar", "Dindori",
        "Guna", "Gwalior", "Harda", "Indore",
        "Jabalpur", "Jhabua", "Katni",
        "Khandwa", "Khargone", "Maihar",
        "Mandla", "Mandsaur", "Mauganj",
        "Morena", "Narmadapuram", "Narsinghpur",
        "Neemuch", "Niwari", "Pandhurna",
        "Panna", "Raisen", "Rajgarh", "Ratlam",
        "Rewa", "Sagar", "Satna", "Sehore",
        "Seoni", "Shahdol", "Shajapur",
        "Sheopur", "Shivpuri", "Sidhi",
        "Singrauli", "Tikamgarh", "Ujjain",
        "Umaria", "Vidisha"
    ],

    "Maharashtra": [
        "Ahmednagar", "Akola", "Amravati",
        "Aurangabad", "Beed", "Bhandara",
        "Buldhana", "Chandrapur", "Dhule",
        "Gadchiroli", "Gondia", "Hingoli",
        "Jalgaon", "Jalna", "Kolhapur",
        "Latur", "Mumbai City",
        "Mumbai Suburban", "Nagpur",
        "Nanded", "Nandurbar", "Nashik",
        "Osmanabad", "Palghar", "Parbhani",
        "Pune", "Raigad", "Ratnagiri",
        "Sangli", "Satara", "Sindhudurg",
        "Solapur", "Thane", "Wardha",
        "Washim", "Yavatmal"
    ],

    "Rajasthan": [
        "Ajmer", "Alwar", "Banswara",
        "Baran", "Barmer", "Bharatpur",
        "Bhilwara", "Bikaner", "Bundi",
        "Chittorgarh", "Churu", "Dausa",
        "Dholpur", "Dungarpur", "Hanumangarh",
        "Jaipur", "Jaisalmer", "Jalore",
        "Jhalawar", "Jhunjhunu", "Jodhpur",
        "Karauli", "Kota", "Nagaur",
        "Pali", "Pratapgarh", "Rajsamand",
        "Sawai Madhopur", "Sikar",
        "Sirohi", "Sri Ganganagar",
        "Tonk", "Udaipur"
    ],

    "Gujarat": [
        "Ahmedabad", "Amreli", "Anand",
        "Aravalli", "Banaskantha", "Bharuch",
        "Bhavnagar", "Botad", "Chhota Udaipur",
        "Dahod", "Dang", "Devbhoomi Dwarka",
        "Gandhinagar", "Gir Somnath",
        "Jamnagar", "Junagadh", "Kheda",
        "Kutch", "Mahisagar", "Mehsana",
        "Morbi", "Narmada", "Navsari",
        "Panchmahal", "Patan", "Porbandar",
        "Rajkot", "Sabarkantha", "Surat",
        "Surendranagar", "Tapi", "Vadodara",
        "Valsad"
    ],

    "Uttar Pradesh": [
        "Agra", "Aligarh", "Ambedkar Nagar",
        "Amethi", "Amroha", "Auraiya",
        "Ayodhya", "Azamgarh", "Baghpat",
        "Bahraich", "Ballia", "Balrampur",
        "Banda", "Barabanki", "Bareilly",
        "Basti", "Bhadohi", "Bijnor",
        "Budaun", "Bulandshahr", "Chandauli",
        "Chitrakoot", "Deoria", "Etah",
        "Etawah", "Farrukhabad", "Fatehpur",
        "Firozabad", "Gautam Buddha Nagar",
        "Ghaziabad", "Ghazipur", "Gonda",
        "Gorakhpur", "Hamirpur", "Hapur",
        "Hardoi", "Hathras", "Jalaun",
        "Jaunpur", "Jhansi", "Kannauj",
        "Kanpur Dehat", "Kanpur Nagar",
        "Kasganj", "Kaushambi", "Kushinagar",
        "Lakhimpur Kheri", "Lalitpur",
        "Lucknow", "Maharajganj", "Mahoba",
        "Mainpuri", "Mathura", "Mau",
        "Meerut", "Mirzapur", "Moradabad",
        "Muzaffarnagar", "Pilibhit",
        "Pratapgarh", "Prayagraj",
        "Raebareli", "Rampur", "Saharanpur",
        "Sambhal", "Sant Kabir Nagar",
        "Shahjahanpur", "Shamli",
        "Shravasti", "Siddharthnagar",
        "Sitapur", "Sonbhadra",
        "Sultanpur", "Unnao", "Varanasi"
    ],

    "Bihar": [
        "Araria", "Arwal", "Aurangabad",
        "Banka", "Begusarai", "Bhagalpur",
        "Bhojpur", "Buxar", "Darbhanga",
        "East Champaran", "Gaya", "Gopalganj",
        "Jamui", "Jehanabad", "Kaimur",
        "Katihar", "Khagaria", "Kishanganj",
        "Lakhisarai", "Madhepura", "Madhubani",
        "Munger", "Muzaffarpur", "Nalanda",
        "Nawada", "Patna", "Purnia",
        "Rohtas", "Saharsa", "Samastipur",
        "Saran", "Sheikhpura", "Sheohar",
        "Sitamarhi", "Siwan", "Supaul",
        "Vaishali", "West Champaran"
    ],

    "Chhattisgarh": [
        "Balod", "Baloda Bazar",
        "Balrampur", "Bastar", "Bemetara",
        "Bijapur", "Bilaspur", "Dantewada",
        "Dhamtari", "Durg", "Gariaband",
        "Gaurela-Pendra-Marwahi",
        "Janjgir-Champa", "Jashpur",
        "Kabirdham", "Kanker", "Kondagaon",
        "Korba", "Korea", "Mahasamund",
        "Mungeli", "Narayanpur", "Raigarh",
        "Raipur", "Rajnandgaon",
        "Sukma", "Surajpur", "Surguja"
    ],

    "Delhi": [
        "Central Delhi", "East Delhi",
        "New Delhi", "North Delhi",
        "North East Delhi", "North West Delhi",
        "Shahdara", "South Delhi",
        "South East Delhi", "South West Delhi",
        "West Delhi"
    ],

    "Haryana": [
        "Ambala", "Bhiwani", "Charkhi Dadri",
        "Faridabad", "Fatehabad", "Gurugram",
        "Hisar", "Jhajjar", "Jind",
        "Kaithal", "Karnal", "Kurukshetra",
        "Mahendragarh", "Nuh", "Palwal",
        "Panchkula", "Panipat", "Rewari",
        "Rohtak", "Sirsa", "Sonipat",
        "Yamunanagar"
    ],

    "Punjab": [
        "Amritsar", "Barnala", "Bathinda",
        "Faridkot", "Fatehgarh Sahib",
        "Fazilka", "Ferozepur", "Gurdaspur",
        "Hoshiarpur", "Jalandhar", "Kapurthala",
        "Ludhiana", "Malerkotla", "Mansa",
        "Moga", "Mohali", "Muktsar",
        "Pathankot", "Patiala", "Rupnagar",
        "Sangrur", "Shaheed Bhagat Singh Nagar",
        "Tarn Taran"
    ],

    "Karnataka": [
        "Bagalkot", "Ballari", "Belagavi",
        "Bengaluru Rural", "Bengaluru Urban",
        "Bidar", "Chamarajanagar",
        "Chikkaballapur", "Chikkamagaluru",
        "Chitradurga", "Dakshina Kannada",
        "Davanagere", "Dharwad", "Gadag",
        "Hassan", "Haveri", "Kalaburagi",
        "Kodagu", "Kolar", "Koppal",
        "Mandya", "Mysuru", "Raichur",
        "Ramanagara", "Shivamogga",
        "Tumakuru", "Udupi", "Uttara Kannada",
        "Vijayapura", "Yadgir"
    ],

    "Tamil Nadu": [
        "Ariyalur", "Chengalpattu",
        "Chennai", "Coimbatore",
        "Cuddalore", "Dharmapuri",
        "Dindigul", "Erode",
        "Kallakurichi", "Kanchipuram",
        "Kanyakumari", "Karur",
        "Krishnagiri", "Madurai",
        "Mayiladuthurai", "Nagapattinam",
        "Namakkal", "Nilgiris",
        "Perambalur", "Pudukkottai",
        "Ramanathapuram", "Ranipet",
        "Salem", "Sivaganga",
        "Tenkasi", "Thanjavur",
        "Theni", "Thoothukudi",
        "Tiruchirappalli", "Tirunelveli",
        "Tirupathur", "Tiruppur",
        "Tiruvallur", "Tiruvannamalai",
        "Tiruvarur", "Vellore",
        "Viluppuram", "Virudhunagar"
    ],

    "Telangana": [
        "Adilabad", "Bhadradri Kothagudem",
        "Hanamkonda", "Hyderabad",
        "Jagtial", "Jangaon",
        "Jayashankar Bhupalpally",
        "Jogulamba Gadwal", "Kamareddy",
        "Karimnagar", "Khammam",
        "Komaram Bheem Asifabad",
        "Mahabubabad", "Mahabubnagar",
        "Mancherial", "Medak",
        "Medchal-Malkajgiri",
        "Mulugu", "Nagarkurnool",
        "Nalgonda", "Narayanpet",
        "Nirmal", "Nizamabad",
        "Peddapalli", "Rajanna Sircilla",
        "Rangareddy", "Sangareddy",
        "Siddipet", "Suryapet",
        "Vikarabad", "Wanaparthy",
        "Warangal", "Yadadri Bhuvanagiri"
    ],

    "West Bengal": [
        "Alipurduar", "Bankura",
        "Birbhum", "Cooch Behar",
        "Dakshin Dinajpur", "Darjeeling",
        "Hooghly", "Howrah",
        "Jalpaiguri", "Jhargram",
        "Kalimpong", "Kolkata",
        "Malda", "Murshidabad",
        "Nadia", "North 24 Parganas",
        "Paschim Bardhaman",
        "Paschim Medinipur",
        "Purba Bardhaman",
        "Purba Medinipur",
        "Purulia", "South 24 Parganas",
        "Uttar Dinajpur"
    ]
}


# ==========================================
# DISTRICT-WISE LOCATION DATA
# Starter locations; add more as needed
# ==========================================

LOCATIONS_BY_DISTRICT = {

    "Madhya Pradesh": {
        "Jabalpur": [
            "Jabalpur",
            "Ranjhi",
            "Adhartal",
            "Gorakhpur",
            "Sihora",
            "Patan",
            "Panagar",
            "Barela",
            "Bhedaghat",
            "Kundam"
        ],

        "Bhopal": [
            "Bhopal",
            "Berasia",
            "Kolar",
            "Bairagarh"
        ],

        "Indore": [
            "Indore",
            "Mhow",
            "Depalpur",
            "Sanwer",
            "Rau"
        ],

        "Gwalior": [
            "Gwalior",
            "Dabra",
            "Bhitarwar"
        ],

        "Ujjain": [
            "Ujjain",
            "Nagda",
            "Mahidpur",
            "Tarana"
        ],

        "Katni": [
            "Katni",
            "Vijayraghavgarh",
            "Barhi",
            "Bahoriband"
        ],

        "Sagar": [
            "Sagar",
            "Bina",
            "Khurai",
            "Rehli"
        ],

        "Rewa": [
            "Rewa",
            "Mangawan",
            "Sirmour"
        ],

        "Satna": [
            "Satna",
            "Nagod",
            "Unchehara"
        ]
    },

    "Maharashtra": {
        "Pune": [
            "Pune",
            "Pimpri-Chinchwad",
            "Hinjewadi",
            "Hadapsar",
            "Kothrud"
        ],

        "Nagpur": [
            "Nagpur",
            "Kamptee",
            "Hingna"
        ],

        "Nashik": [
            "Nashik",
            "Malegaon",
            "Sinnar"
        ],

        "Thane": [
            "Thane",
            "Kalyan",
            "Dombivli",
            "Bhiwandi"
        ]
    },

    "Rajasthan": {
        "Jaipur": [
            "Jaipur",
            "Sanganer",
            "Amer"
        ],

        "Jodhpur": [
            "Jodhpur",
            "Osian"
        ],

        "Udaipur": [
            "Udaipur",
            "Gogunda"
        ]
    },

    "Uttar Pradesh": {
        "Lucknow": [
            "Lucknow",
            "Gomti Nagar",
            "Alambagh"
        ],

        "Varanasi": [
            "Varanasi",
            "Ramnagar"
        ],

        "Agra": [
            "Agra",
            "Fatehpur Sikri"
        ],

        "Gautam Buddha Nagar": [
            "Noida",
            "Greater Noida",
            "Dadri"
        ]
    },

    "Delhi": {
        "New Delhi": [
            "New Delhi",
            "Connaught Place",
            "Chanakyapuri"
        ],

        "South West Delhi": [
            "Dwarka",
            "Najafgarh"
        ],

        "North West Delhi": [
            "Rohini",
            "Narela"
        ]
    },

    "Gujarat": {
        "Ahmedabad": [
            "Ahmedabad",
            "Maninagar",
            "Bopal"
        ],

        "Surat": [
            "Surat",
            "Adajan",
            "Varachha"
        ],

        "Vadodara": [
            "Vadodara",
            "Alkapuri"
        ]
    },

    "Karnataka": {
        "Bengaluru Urban": [
            "Bengaluru",
            "Whitefield",
            "Electronic City",
            "Yelahanka"
        ],

        "Mysuru": [
            "Mysuru",
            "Nanjangud"
        ]
    },

    "Tamil Nadu": {
        "Chennai": [
            "Chennai",
            "T Nagar",
            "Adyar",
            "Velachery"
        ],

        "Coimbatore": [
            "Coimbatore",
            "Pollachi"
        ]
    },

    "Telangana": {
        "Hyderabad": [
            "Hyderabad",
            "Banjara Hills",
            "Jubilee Hills"
        ],

        "Warangal": [
            "Warangal"
        ]
    },

    "Bihar": {
        "Patna": [
            "Patna",
            "Danapur",
            "Phulwari Sharif"
        ],

        "Gaya": [
            "Gaya",
            "Bodh Gaya"
        ]
    }
}


# ==========================================
# INDIAN AQI HEALTH ADVISORY
# ==========================================

def indian_advisory(aqi):
    if aqi <= 50:
        return {
            "category": "Good",
            "advice": "Normal outdoor activities are generally fine."
        }

    if aqi <= 100:
        return {
            "category": "Satisfactory",
            "advice": "Sensitive people should monitor symptoms."
        }

    if aqi <= 200:
        return {
            "category": "Moderate",
            "advice": "Sensitive groups should limit prolonged outdoor exertion."
        }

    if aqi <= 300:
        return {
            "category": "Poor",
            "advice": "Reduce prolonged outdoor exercise."
        }

    if aqi <= 400:
        return {
            "category": "Very Poor",
            "advice": "Avoid strenuous outdoor activities."
        }

    return {
        "category": "Severe",
        "advice": "Avoid outdoor exertion and minimize exposure."
    }


# ==========================================
# US AQI HEALTH ADVISORY
# ==========================================

def us_advisory(aqi):
    if aqi <= 50:
        return {
            "category": "Good",
            "advice": "Outdoor activities are generally fine."
        }

    if aqi <= 100:
        return {
            "category": "Moderate",
            "advice": "Unusually sensitive people should consider reducing prolonged outdoor exertion."
        }

    if aqi <= 150:
        return {
            "category": "Unhealthy for Sensitive Groups",
            "advice": "Sensitive groups should reduce prolonged outdoor exertion."
        }

    if aqi <= 200:
        return {
            "category": "Unhealthy",
            "advice": "Everyone should reduce prolonged outdoor exertion."
        }

    if aqi <= 300:
        return {
            "category": "Very Unhealthy",
            "advice": "Avoid prolonged outdoor activities."
        }

    return {
        "category": "Hazardous",
        "advice": "Avoid outdoor physical activity and minimize exposure."
    }


# ==========================================
# HOME PAGE
# ==========================================

@app.get("/")
def home():
    return render_template("index.html")


# ==========================================
# ML MODEL CONFIGURATION
# ==========================================

@app.get("/api/config")
def config():
    return jsonify({
        "project": "Air Quality Index",
        "model": model_name,
        "features": features
    })


# ==========================================
# GET STATES
# ==========================================

@app.get("/api/states")
def states():
    return jsonify({
        "states": INDIAN_STATES
    })


# ==========================================
# GET DISTRICTS BY STATE
# ==========================================

@app.get("/api/districts")
def get_districts():
    state = request.args.get(
        "state", ""
    ).strip()

    if state not in INDIAN_STATES:
        return jsonify({
            "error": "Invalid state selected."
        }), 400

    districts = DISTRICTS_BY_STATE.get(
        state, []
    )

    return jsonify({
        "state": state,
        "districts": sorted(districts)
    })


# ==========================================
# GET LOCATIONS BY DISTRICT
# ==========================================

@app.get("/api/locations")
def get_locations():
    state = request.args.get(
        "state", ""
    ).strip()

    district = request.args.get(
        "district", ""
    ).strip()

    if state not in INDIAN_STATES:
        return jsonify({
            "error": "Invalid state selected."
        }), 400

    valid_districts = DISTRICTS_BY_STATE.get(
        state, []
    )

    if district not in valid_districts:
        return jsonify({
            "error": "Invalid district selected."
        }), 400

    locations = LOCATIONS_BY_DISTRICT.get(
        state, {}
    ).get(district, [])

    # The district's main town can still be
    # selected even if no smaller location
    # list has been configured.
    if not locations:
        locations = [district]

    return jsonify({
        "state": state,
        "district": district,
        "locations": sorted(set(locations))
    })


# ==========================================
# SEARCH LOCATION USING NOMINATIM
# ==========================================

@app.get("/api/location/search")
def search_location():
    state = request.args.get(
        "state", ""
    ).strip()

    district = request.args.get(
        "district", ""
    ).strip()

    place = request.args.get(
        "place", ""
    ).strip()

    if state not in INDIAN_STATES or not place:
        return jsonify({
            "error": "Select a valid state and enter a city or area."
        }), 400

    if any(
        len(value) > 120
        for value in (state, district, place)
    ):
        return jsonify({
            "error": "Location input is too long."
        }), 400

    query = ", ".join(
        part
        for part in (
            place,
            district,
            state,
            "India"
        )
        if part
    )

    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/search",

            params={
                "q": query,
                "format": "json",
                "addressdetails": 1,
                "countrycodes": "in",
                "limit": 5
            },

            headers={
                "User-Agent":
                    "AirQualityIndexEducationalProject/1.0 (student learning project)"
            },

            timeout=15
        )

        response.raise_for_status()

        locations = []

        for item in response.json():
            if (
                item.get("address", {}).get(
                    "country_code"
                ) != "in"
            ):
                continue

            locations.append({
                "name": item["display_name"],
                "latitude": float(item["lat"]),
                "longitude": float(item["lon"])
            })

        return jsonify({
            "locations": locations
        })

    except (
        requests.RequestException,
        ValueError,
        KeyError,
        TypeError
    ):
        return jsonify({
            "error": "Location search is temporarily unavailable."
        }), 503


# ==========================================
# LIVE AQI FROM OPEN-METEO
# ==========================================

@app.get("/api/live-aqi")
def live_aqi():
    try:
        lat = float(
            request.args.get("lat", "nan")
        )

        lon = float(
            request.args.get("lon", "nan")
        )

    except (TypeError, ValueError):
        return jsonify({
            "error": "Invalid latitude or longitude."
        }), 400

    if not (
        math.isfinite(lat)
        and math.isfinite(lon)
        and 6 <= lat <= 38
        and 68 <= lon <= 98
    ):
        return jsonify({
            "error": "Invalid coordinates for India."
        }), 400

    try:
        response = requests.get(
            "https://air-quality-api.open-meteo.com/v1/air-quality",

            params={
                "latitude": lat,
                "longitude": lon,

                "current":
                    "us_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,ozone",

                "hourly": "us_aqi",
                "timezone": "Asia/Kolkata",
                "forecast_days": 2
            },

            timeout=20
        )

        response.raise_for_status()
        payload = response.json()

    except (
        requests.RequestException,
        ValueError
    ):
        return jsonify({
            "error": "Air quality service is temporarily unavailable."
        }), 503

    current = payload.get("current") or {}
    current_units = payload.get("current_units") or {}
    hourly = payload.get("hourly") or {}

    current_aqi = current.get("us_aqi")

    if current_aqi is None:
        return jsonify({
            "error": "AQI is unavailable for this location."
        }), 503

    tomorrow = (
        datetime.now(
            ZoneInfo("Asia/Kolkata")
        ).date() + timedelta(days=1)
    ).isoformat()

    hourly_records = [
        {
            "time": timestamp,
            "aqi": value
        }
        for timestamp, value in zip(
            hourly.get("time") or [],
            hourly.get("us_aqi") or []
        )
        if (
            isinstance(timestamp, str)
            and isinstance(value, (int, float))
            and math.isfinite(value)
        )
    ]

    tomorrow_values = [
        record["aqi"]
        for record in hourly_records
        if record["time"].startswith(tomorrow)
    ]

    tomorrow_average = (
        round(
            sum(tomorrow_values)
            / len(tomorrow_values),
            1
        )
        if tomorrow_values
        else None
    )

    pollutant_keys = (
        "pm2_5",
        "pm10",
        "nitrogen_dioxide",
        "sulphur_dioxide",
        "carbon_monoxide",
        "ozone"
    )

    pollutants = {
        key: {
            "value": current.get(key),
            "unit": current_units.get(key, "")
        }
        for key in pollutant_keys
    }

    return jsonify({
        "source": "Open-Meteo / CAMS model",
        "aqi_scale": "US AQI",
        "measurement_type": "Modeled estimate",

        "time": current.get("time"),

        "current_aqi": current_aqi,

        "current_advisory":
            us_advisory(current_aqi),

        "pollutants": pollutants,

        "tomorrow_date": tomorrow,

        "tomorrow_average_aqi":
            tomorrow_average,

        "tomorrow_advisory": (
            us_advisory(tomorrow_average)
            if tomorrow_average is not None
            else None
        ),

        "hourly_aqi": hourly_records
    })


# ==========================================
# ML NEXT-DAY AQI PREDICTION
# ==========================================

@app.post("/predict")
def predict():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "Valid JSON input required."
        }), 400

    missing = [
        feature
        for feature in features
        if feature not in data
    ]

    if missing:
        return jsonify({
            "error": "Missing features",
            "missing": missing
        }), 400

    try:
        input_df = pd.DataFrame([
            {
                feature: data[feature]
                for feature in features
            }
        ])

        input_df = input_df.apply(
            pd.to_numeric,
            errors="coerce"
        )

        if not input_df.notna().all().all():
            return jsonify({
                "error": "All inputs must be numeric."
            }), 400

        if not all(
            math.isfinite(float(value))
            for value in input_df.iloc[0]
        ):
            return jsonify({
                "error": "Inputs must be finite numbers."
            }), 400

        prediction = float(
            model.predict(input_df)[0]
        )

        if not math.isfinite(prediction):
            return jsonify({
                "error": "Model returned an invalid prediction."
            }), 500

        prediction = max(
            0.0,
            prediction
        )

        return jsonify({
            "predicted_next_day_aqi":
                round(prediction, 2),

            "aqi_scale":
                "Indian AQI (historical dataset)",

            "model": model_name,

            "health_advisory":
                indian_advisory(prediction)
        })

    except (
        ValueError,
        TypeError
    ) as error:
        return jsonify({
            "error": str(error)
        }), 400


# ==========================================
# RUN FLASK APPLICATION
# ==========================================

if __name__ == "__main__":
    app.run(debug=True)
