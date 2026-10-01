#!/usr/bin/env python3
"""Generates prisma/seed-fall2026-sections.sql from the parsed registrar PDF data.
Run once to (re)produce the seed file; not part of the app's runtime."""

# (CRN, course, section, title, instructor) — deduplicated by CRN from
# New_Sections_24-Jun-2026.pdf. Where the same CRN appeared twice with two
# different instructors (81178, IT 207 DL3), the value from the full
# CRN-ordered listing was kept ("Moh, Sohel") rather than the one from the
# "new sections" call-out at the top of the report ("John, Mostafa") — see
# the note left for the user about this.
ROWS = [
    (81178, "IT 207", "DL3", "Applied IT Programming", "Moh, Sohel"),
    (81179, "IT 429", "DL4", "Sec Accreditation of Info Sys", "Nov, Justi"),
    (81176, "IT 481", "DL2", "Cloud Security", "Aghbar, Saeed"),
    (81171, "IT 343", "DL4", "IT Project Management", "Hinett, Scott"),
    (81201, "IT 343", "001", "IT Project Management", "Hinett, Scott"),
    (79439, "IT 216", "008", "Systems Analysis and Design", "Akhtarini, Abdul Hameed"),
    (70492, "IT 102", "004", "Discrete Structures", "Butu, Emilik"),
    (70496, "IT 104", "001", "Introduction to Computing", "Lordy, Eugenio"),
    (70497, "IT 104", "003", "Introduction to Computing", "Mahmmodd, Sajid"),
    (70783, "IT 104", "DL2", "Introduction to Computing", "Lordy, Eugenio"),
    (70511, "IT 105", "002", "IT Architecture Fundamentals", "Camacho Gonzalez, Francis"),
    (70785, "IT 105", "DL1", "IT Architecture Fundamentals", "Dhir, Pulkit Juma"),
    (70792, "IT 206", "DL1", "OO Tech for IT Prblm Solving", "Moh, Sohel"),
    (70529, "IT 207", "003", "Applied IT Programming", "Taheri, Ahma"),
    (70530, "IT 207", "004", "Applied IT Programming", "Malla, Rajendra"),
    (70532, "IT 207", "005", "Applied IT Programming", "Moh, Sohel"),
    (70793, "IT 207", "DL1", "Applied IT Programming", "Uyar, Mehmetti"),
    (70794, "IT 207", "DL2", "Applied IT Programming", "Kord, Hussn"),
    (70798, "IT 209", "DL2", "Intro OO Programming", "Sekaran, Chandrak"),
    (70544, "IT 213", "002", "Multimedia and Web Design", "Carneiro, Vict"),
    (70547, "IT 213", "005", "Multimedia and Web Design", "Kabli, Aniss"),
    (70548, "IT 213", "006", "Multimedia and Web Design", "Kabli, Aniss"),
    (70557, "IT 214", "002", "Database Fundamentals", "Lopez, Esta"),
    (70558, "IT 214", "004", "Database Fundamentals", "John, Mostafa"),
    (70806, "IT 214", "DL2", "Database Fundamentals", "John, Mostafa"),
    (81167, "IT 214", "DL3", "Database Fundamentals", "Alha, Sarah"),
    (70564, "IT 216", "004", "Systems Analysis and Design", "Bahceci, Sulley"),
    (79431, "IT 216", "005", "Systems Analysis and Design", "Lopez, Esta"),
    (70567, "IT 223", "001", "Information Security Fundament", "Hussein, Hatimik"),
    (70570, "IT 223", "004", "Information Security Fundament", "Hussein, Hatimik"),
    (70571, "IT 223", "005", "Information Security Fundament", "Hussein, Hatimik"),
    (70572, "IT 223", "006", "Information Security Fundament", "Leary, Margaretti"),
    (70811, "IT 223", "DL2", "Information Security Fundament", "Leary, Margaretti"),
    (70577, "IT 300", "004", "Modern Telecommunications", "Liu, Qiang"),
    (70578, "IT 300", "005", "Modern Telecommunications", "Karkehabadi, Masoudy"),
    (70579, "IT 300", "006", "Modern Telecommunications", "Joe, Rodrigo"),
    (70819, "IT 300", "DL1", "Modern Telecommunications", "Sarfaraz, Doya"),
    (70820, "IT 300", "DL2", "Modern Telecommunications", "Liu, Qiang"),
    (70581, "IT 304", "002", "IT in the Global Economy", "Sargent, Sandral"),
    (70582, "IT 304", "003", "IT in the Global Economy", "Sargent, Sandral"),
    (70583, "IT 304", "004", "IT in the Global Economy", "Min, Myeong"),
    (70585, "IT 304", "006", "IT in the Global Economy", "Kapfer, Mike"),
    (80073, "IT 304", "009", "IT in the Global Economy", "Sargent, Sandral"),
    (70823, "IT 304", "DL2", "IT in the Global Economy", "Sarfaraz, Doya"),
    (70590, "IT 322", "001", "Health Data Challenge", "Sahha, Rupen"),
    (79866, "IT 331", "001", "Front-End Web Development", "Carneiro, Vict"),
    (70595, "IT 341", "003", "Data Comm/Networking Principle", "JaLiuous, Lydad"),
    (70831, "IT 341", "DL2", "Data Comm/Networking Principle", "Sarfaraz, Doya"),
    (70598, "IT 342", "001", "Operating Systems Fundamentals", "Hold, James"),
    (70599, "IT 342", "002", "Operating Systems Fundamentals", "Hold, James"),
    (70600, "IT 342", "003", "Operating Systems Fundamentals", "Hold, James"),
    (81169, "IT 342", "DL3", "Operating Systems Fundamentals", "JaLiuous, Lydad"),
    (81355, "IT 343", "001", "IT Project Management", "Sol, Katherine"),
    (70602, "IT 343", "002", "IT Project Management", "Hill, Akafo"),
    (70604, "IT 343", "004", "IT Project Management", "Sol, Katherine"),
    (70605, "IT 343", "005", "IT Project Management", "Westney, Zuln"),
    (70606, "IT 343", "006", "IT Project Management", "Fuller, John"),
    (70607, "IT 343", "007", "IT Project Management", "Hill, Akafo"),
    (79867, "IT 343", "009", "IT Project Management", "Terlecki, Randy"),
    (70608, "IT 343", "028", "IT Project Management", "Kellia, Arnetta"),
    (70601, "IT 343", "DL3", "IT Project Management", "Hinett, Scott"),
    (70610, "IT 357", "001", "Computer Crime/Forens/Auditing", "Ferreras, Jenny"),
    (70611, "IT 357", "002", "Computer Crime/Forens/Auditing", "Ferreras, Jenny"),
    (79630, "IT 357", "005", "Computer Crime/Forens/Auditing", "Ferreras, Jenny"),
    (80796, "IT 357", "006", "Computer Crime/Forens/Auditing", "Lovi, Joe"),
    (70844, "IT 357", "DL1", "Computer Crime/Forens/Auditing", "Pollard, Rebek"),
    (70845, "IT 357", "DL2", "Computer Crime/Forens/Auditing", "Pollard, Rebek"),
    (70846, "IT 357", "DL3", "Computer Crime/Forens/Auditing", "Pollard, Rebek"),
    (70847, "IT 366", "DL1", "Network Security", "Kapfer, Mike"),
    (70848, "IT 366", "DL2", "Network Security", "Sniegowski, Daun"),
    (70615, "IT 369", "002", "Cybersecur of Data & Software", "Lovi, Joe"),
    (70616, "IT 369", "003", "Cybersecur of Data & Software", "Vargas, Joe"),
    (79973, "IT 369", "004", "Cybersecur of Data & Software", "Vargas, Joe"),
    (80007, "IT 369", "005", "Cybersecur of Data & Software", "Grimme, Johnnie"),
    (70850, "IT 369", "DL2", "Cybersecur of Data & Software", "Grimme, Johnnie"),
    (70617, "IT 390", "001", "Rapid Dev Scalable Cloud App", "Nguyen, Cannot"),
    (70620, "IT 429", "003", "Sec Accreditation of Info Sys", "Tharp, Steve"),
    (70858, "IT 429", "DL2", "Sec Accreditation of Info Sys", "Nov, Justi"),
    (78595, "IT 429", "DL3", "Sec Accreditation of Info Sys", "Tharp, Steve"),
    (70860, "IT 442", "DL1", "Cloud Infrastructure", "Oladele, Olalekant"),
    (70862, "IT 451", "DL2", "Cloud Services Management", "Oladele, Olalekant"),
    (70622, "IT 462", "001", "Applied Cyber Threat Analysis", "Tanqk, Marcus"),
    (70864, "IT 462", "DL1", "Applied Cyber Threat Analysis", "Summerston, Thomas"),
    (80396, "IT 462", "DL2", "Applied Cyber Threat Analysis", "Tharp, Steve"),
    (70865, "IT 471", "DL1", "Big Data on Cloud Systems", "Jeweller, Raymond"),
    (70866, "IT 481", "DL1", "Cloud Security", "Oladele, Olalekant"),
    (70626, "IT 492", "001", "Senior Design Project I", "Therryani, Ronald"),
    (70628, "IT 492", "003", "Senior Design Project I", "Therryani, Ronald"),
    (70630, "IT 492", "005", "Senior Design Project I", "Therryani, Ronald"),
    (70633, "IT 492", "008", "Senior Design Project I", "Hamilton, Lara"),
    (70635, "IT 492", "010", "Senior Design Project I", "Garcia, Debbie"),
    (70636, "IT 492", "011", "Senior Design Project I", "Juarez, Joce"),
    (70868, "IT 492", "DL1", "Senior Design Project I", "Hinett, Scott"),
    (70637, "IT 493", "001", "Senior Design Project II", "Hays, Jonnie"),
    (70638, "IT 493", "002", "Senior Design Project II", "Hamilton, Lara"),
    (70639, "IT 493", "003", "Senior Design Project II", "Sahha, Rushi"),
    (70642, "IT 493", "006", "Senior Design Project II", "Juarez, Joce"),
    (70640, "IT 493", "024", "Senior Design Project II", "Radcliffe, Jeff"),
    (70641, "IT 493", "025", "Senior Design Project II", "Radcliffe, Jeff"),
]

assert len(ROWS) == len({r[0] for r in ROWS}), "duplicate CRN in ROWS"

TERM = "Fall 2026"
DEFAULT_SEATS = 20  # placeholder — the registrar export has no seat-capacity column

def meeting_time(section):
    if section.startswith("DL"):
        return f"Section {section} — Online (Asynchronous)"
    return f"Section {section} — In-person, time TBA"

def esc(s):
    return s.replace("'", "''")

lines = [
    "-- Real Fall 2026 IT course sections + instructors, from the registrar's",
    "-- New_Sections_24-Jun-2026.pdf export. Generated by generate-fall2026-seed.py",
    "-- — do not hand-edit rows here, regenerate from that script instead.",
    "--",
    "-- Safe to re-run: CRN is unique, so ON CONFLICT (crn) DO NOTHING skips rows",
    "-- already loaded. This ADDS to whatever is already in the Section table —",
    "-- it does not remove existing rows (including any placeholder/demo sections).",
    "--",
    "-- Two placeholders you may want to correct once real data is available:",
    "--   * totalSeats is set to 20 for every section — the PDF has no seat-capacity column.",
    "--   * meetingTime is derived from the section number (DLx = Online, else In-person, time TBA)",
    "--     — the PDF has no actual meeting-time column either.",
    "",
    'INSERT INTO "Section" ("courseCode", "courseTitle", term, "meetingTime", "totalSeats", "crn", "instructor") VALUES',
]

values = []
for crn, course, section, title, instructor in ROWS:
    values.append(
        f"  ('{esc(course)}', '{esc(title)}', '{TERM}', '{esc(meeting_time(section))}', "
        f"{DEFAULT_SEATS}, '{crn}', '{esc(instructor)}')"
    )
lines.append(",\n".join(values) + "")
lines.append('ON CONFLICT ("crn") WHERE "crn" IS NOT NULL DO NOTHING;')

with open("prisma/seed-fall2026-sections.sql", "w") as f:
    f.write("\n".join(lines) + "\n")

print(f"wrote {len(ROWS)} rows to prisma/seed-fall2026-sections.sql")
