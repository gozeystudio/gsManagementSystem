# NIBRAS EDUCATIONAL COMPLEX — Offline School Management System
### "Knowledge is Light"

A self-contained, offline-first school management system. It has **zero external
dependencies** — no npm install, no internet connection, no cloud services. It uses
only Node.js's built-in web server and built-in SQLite database.

---

## 1. What's included

- Login & role-based accounts (Super Administrator, Headteacher, Headmistress, Teacher,
  Non-teaching Staff, Accountant/Bursar, Parent/Guardian) with a configurable
  view/add/edit/delete/export permission matrix per role
- Dashboard with live school statistics
- Students (full profile: academic, welfare, orphan status, bus, canteen, medical/emergency info)
- Parents & Guardians (linked to students, independent Alive/Deceased status per parent)
- Teachers, Non-teaching Staff
- Classes & Subjects
- Academic Years & Terms (with "set current" control)
- Attendance (mark by class/date, per-student history)
- Results & configurable grading system, printable report cards
- Fees, fee types, and payments with receipt numbers
- School Bus register
- Canteen tracking
- Internal Announcements
- **Passport photo uploads** for students, teachers, and non-teaching staff — a file picker with instant preview, resized automatically on your device before upload so it never bloats the database
- **Automatic ID numbers** — admin-configurable prefix and digit count (defaults: students `NIB/<year>/001`, staff `ST/<year>/001`), both counting up automatically per year. No one has to invent or type an ID, and once assigned an ID can't be accidentally changed. A student's Admission Number is always the same as their Student ID.
- **School identity & branding, fully admin-editable** — school name, logo (upload your own), motto, address, location, phone, and email, all managed from Settings and automatically reflected on the login screen, sidebar, printable report cards, and fee receipts
- **Configurable Continuous Assessment style** — rename each of the 4 CA components, change their max marks, and adjust the CA/Exam weight split (defaults to 50/50) — all from Settings, with a live validator so the two weights always add to 100%
- **Performance Report** — rank every active student by average final score, whole-school or one class at a time, for any term, as a printable list
- **Automatic weekly backup email** — configure an SMTP provider and a recipient address once, and the system checks every Friday (while it's running with internet access) and emails a copy of the backup automatically; a "Send Backup Now" button is also available any time
- **Mobile-friendly layout** — on a phone or tablet, the sidebar becomes a slide-out menu (tap the ☰ icon), and all forms, tables, and the report card reflow to fit the screen
- **Liquid Glass interface** — a modern frosted-glass visual design (translucent panels, soft depth, blur) throughout the app; printable documents (report cards, receipts) stay fully solid and opaque so they print cleanly
- Audit log of key actions (logins, creates, edits, deletes, payments, restores)
- Backup & Restore, with a safety copy made automatically before every restore

### Newest additions

- **Day / Boarder status**, **Scholarship status** (None/Full/Partial/Bursary/Sponsored) on
  student profiles; **PTA membership** on parent profiles; **Salary** on teacher profiles
- **Filter & Print** on Students, Parents, Teachers, and Non-teaching Staff — narrow the list
  by class, status, gender, orphan status, day/boarder, bus, canteen, qualification, position,
  or PTA membership, then print a clean branded list of exactly what's filtered
- **Teacher Qualification** is now a fixed dropdown (PhD down to "Other Qualification"),
  so entries stay consistent across the whole staff list
- **BECE-style grading (1 = highest, 9 = lowest)**, fully editable under Results → Grading
  System — see the caveat in section 7 about how this differs from the real national exam
- **Report cards fit one A4 page** and no longer show a "Remark" column (renamed to
  "Description" everywhere else in the system); print one student's card, or every student in
  a class at once (each on their own page) from the Results page
- **Parent Contact List** — a printable sheet of every parent/guardian's phone numbers and
  which student(s) they're linked to, filterable to PTA members only
- **Student ID Cards** — generates credit-card-sized printable ID cards for a whole class at
  once, ready to print onto card stock and laminate
- **Alumni & Student Status** — move students between Active, Graduated, Alumni, Transferred,
  Withdrawn, or Stopped, and print a list of students in any one status
- **New Admissions report** — lists every student admitted within a chosen term's date range
- **Fees Report** — filter who's paid in full, partially paid, or not paid at all, by term
  and/or class, with running balances; fee assignment now also records which term it's for
- **Class list Excel/CSV export & import** — download a class's student names as a spreadsheet
  file (opens directly in Excel), edit it, and upload it back to bulk-add or update names
- **Social sharing on Announcements** — a Share button opens WhatsApp, X (Twitter), Facebook,
  or copy-to-clipboard for the announcement text (needs an internet connection at that moment
  — the system itself stays fully offline otherwise)
- **Dashboard background image & icons** — upload a background photo for the Dashboard in
  Settings (a soft overlay keeps the stat cards readable over any image), and every stat card
  now has its own icon

## 2. One-time setup (needs internet, only once)

The school computer needs **Node.js** installed (this is what runs the system —
after this one install, the whole system works with no internet ever again):

1. Go to https://nodejs.org on any computer with internet.
2. Download the **LTS** installer for Windows (version 22 or newer).
3. Run the installer with default options.
4. Copy this whole `nibras-school-system` folder onto the school computer (USB drive is fine).

## 3. Running the system

Double-click **`Start Nibras School System.bat`**.

- A window will open showing the server starting up.
- Your browser will open automatically to `http://localhost:3000`.
- Log in with:
  - **Username:** `admin`
  - **Password:** `Admin@123`
- **Change this password immediately** (Users & Roles → Edit → set new password).

Leave the black window open while the system is in use — closing it stops the server.

### Using it from a phone or other computers on the same school network

You no longer need to hunt for the IP address yourself — look at the black window after
starting the system. It now prints exactly what to type, for example:

```
On THIS computer, open:   http://localhost:3000
On a PHONE or another computer on the same Wi-Fi, open:
    http://192.168.1.20:3000
```

On your phone, connect to the **same Wi-Fi network** as the school computer, then open
that second address in any browser. No internet is used — this is entirely local network
traffic. If it still doesn't load:
- **Windows Firewall:** the first time, Windows may pop up asking to allow Node.js through
  the firewall — click **Allow access** (for Private networks). If you missed that prompt,
  search Windows for "Allow an app through Windows Firewall" and make sure Node.js is checked.
- **Guest Wi-Fi:** some routers put "Guest" networks in isolation mode, where devices can't
  see each other even though they're on the same Wi-Fi name — connect the phone to the main
  network instead, if there is one.
- **The server must stay running:** if the black window is closed, or the computer goes to
  sleep, nothing else on the network can reach it until it's started again.
- If the window shows "No network connection detected," that computer itself isn't connected
  to any Wi-Fi/LAN at all — connect it first, then restart the system.

## 4. Backups

Go to **Backup & Restore** in the sidebar:
- **Create Backup Now** saves a timestamped copy of the database
  (e.g. `Nibras_Backup_2026-08-19-20-59-16.db`) into the `backups` folder.
- **Download** lets you save that file to a USB drive or another computer — do this
  regularly, since backups stored only on the same computer aren't protected if
  that computer fails.
- **Restore** replaces all current data with a chosen backup. You'll see a clear
  warning first, and a safety copy of your current data is taken automatically
  before the restore happens, just in case. After restoring, close and reopen
  "Start Nibras School System".

Do this backup routine at least weekly, and always before restoring, upgrading, or
moving the system to a new computer.

### Automatic weekly backup email (optional)

In **Settings**, you can configure this system to email a copy of the backup to an
address of your choice automatically every Friday, as long as the computer has
internet access at the time. To set it up you'll need SMTP details from an email
provider — for example, with a Gmail account:
- **Host:** `smtp.gmail.com`, **Port:** `465`, **Secure:** on
- **Username:** your Gmail address
- **Password:** a Google **App Password** (not your normal Gmail password — search
  "Google App Passwords" for how to generate one; this is required because Google
  blocks regular password logins from apps like this one)

Click **Send Backup Now** after saving to confirm it actually works before
relying on the Friday automation — a wrong password or host is the most common
issue, and the error message will say exactly which step failed. If the computer
is asleep, off, or offline at the exact time on Friday, it will simply try again
the next time it's checked, but it will not "catch up" and send a missed backup
retroactively once several days have passed.

## 5. Where your data lives

- Live database: `data/nibras.db`
- Backups: `backups/`

Both are plain files. To move the whole system to a new computer, copy the entire
`nibras-school-system` folder (including `data` and `backups`).

## 6. About the missing `.exe`

This build ships as a Node.js application rather than a compiled `.exe` for a
practical reason: producing a genuinely standalone Windows executable requires
packaging tools (like `pkg` or `electron-builder`) that themselves need to be
downloaded from the internet — and this system was built in a sandboxed
environment with no internet access at all, to match your offline requirement
as closely as possible.

The `.bat` launcher gives the same one-click experience for school staff — it's
just as simple to use day to day. If you'd like a true compiled `.exe` later, on
any machine *with* internet access you (or I, in a future session) can run:

```
npm install -g pkg
pkg server.js --targets node22-win-x64 --output "Nibras School System.exe"
```

That produces a single `.exe` that bundles Node.js itself, so the target computer
won't even need Node.js installed. I'm glad to walk through this with you, or do
it directly, whenever you have that access available.

## 7. Continuous Assessment (CA) grading structure

The Results module uses your school's specific scoring formula:

| Component        | Out of | Contributes to |
|-------------------|--------|-----------------|
| Class Exercise     | 15     | CA Total (/60) |
| Class Test         | 15     | CA Total (/60) |
| Group Work         | 15     | CA Total (/60) |
| Project Work       | 15     | CA Total (/60) |
| **CA Total**       | **/60**| scaled to **50%** of final grade |
| **Exam**           | **/100**| scaled to **50%** of final grade |
| **Final Score**    | **/100**| CA (50%) + Exam (50%) |

Example: a student scoring 10, 12, 8, 9 (CA Total 39/60) and 65/100 on the exam gets
CA scaled = 39/60 × 50 = 32.5, Exam scaled = 65/100 × 50 = 32.5, **Final = 65/100**.

This is entered per class/subject/term under **Results** in the sidebar, with live-computed
totals as you type, and shows on both the student profile and the printable report card,
broken down by component so nothing is a "black box" for parents or staff. Out-of-range
entries (e.g. typing 20 for something out of 15) are automatically capped to the valid maximum.

The **report card** itself (also generated from the Results page, by entering a Student ID)
is a full letterhead-style design: school logo and contact details, the student's photo,
an attendance summary, the subject breakdown table, overall average, class position, a
grading key, remark boxes, and signature lines — ready to print.

### BECE-style grading (Ghana), and an important caveat

Grades are now shown on the Ghanaian **9-point scale used for BECE** (1 = highest, 9 = lowest —
the reverse of A–F letter grading), with these default boundaries:

| Grade | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| % range | 80–100 | 70–79 | 60–69 | 55–59 | 50–54 | 45–49 | 40–44 | 35–39 | 0–34 |
| Meaning | Excellent | Very Good | Good | Credit (High) | Credit | Credit (Low) | Pass (High) | Pass | Fail |

**Important:** the real, official BECE national exam does **not** use fixed percentage
cutoffs like this — WAEC grades it using a norm-referenced "stanine" system based on how
every candidate nationwide performs that year, which only WAEC can calculate. No school
software (this one included) can reproduce that. The scale above is the fixed-percentage
convention Ghanaian JHS schools commonly use for their own internal continuous assessment
and mock exam reporting — it's a reasonable approximation, not an official WAEC feed.

Because grade boundaries do shift over time and can vary by school/circular, every band is
editable: go to **Results → Grading System** at the bottom of the page to add, edit, or
delete grade bands. This also means you can switch back to A–F letter grading, or any other
scale, at any time — it's just data, not hardcoded.

### Printing results

- **One student:** Results → "Print One Student's Report Card" → enter their Student ID
  (e.g. `NIB/2026/001`) and term → Generate.
- **A whole class at once:** Results → "Print an Entire Class's Report Cards" → pick a
  class and term → Generate All. This produces every active student's full report card,
  one after another, each landing on its own page when printed — hand them out individually
  after cutting/separating the printed pages.
- **A ranked list instead of individual sheets:** use **Performance Report** in the sidebar
  for a single-table ranking of the whole school or one class (see section on Performance
  Report above) — that's a summary list, not individual report cards.

## 8. What's simplified in this first version (and can be extended)

To get you a genuinely working system rather than a shell of every feature in the
original spec, a few things are intentionally lean for v1 and easy to build out
further on request:
- Class/teacher/subject assignment linking tables exist in the database but don't
  yet have a dedicated UI (currently managed by editing the relevant records).
- Report cards are generated on-screen/printable; a polished PDF export isn't wired up yet.
- CSV/PDF bulk export buttons aren't yet on every list (the data is all reachable via
  the API for now).
- Bus/canteen assignment is done from the student's edit form rather than a
  dedicated assignment screen.
- Parent portal login exists as a role but the parent-facing "my child's info" view
  isn't built yet.

None of this affects the offline requirement, data safety, or role security — it's
just breadth of UI. Let me know which of these matter most for how your school will
actually use it day one, and I'll prioritize those next.

## 9. Timetable, Language Support, and Dashboard Personalization

### Staff Check-in / Check-out
Under **Staff Check-in** in the sidebar:
- **QR code check-in (recommended)** — generate a personal QR code for any teacher or staff
  member; they scan it with their **own phone's regular camera app** (no login, no extra app)
  to check in, and scan the same code again later to check out. This was built and verified
  carefully: the QR encoder was written from the official spec and tested by rendering real
  codes and decoding them with a standard QR reader to confirm they scan correctly — including
  the exact browser-rendered version used in this app, not just a theoretical test.
- **PIN kiosk** — a separate, login-free page at `/kiosk.html` for a shared tablet/device at
  the entrance: staff type their Staff ID and a personal PIN to check in/out.
- **Automated attendance log & overtime summary** — filterable by date range, with overtime
  automatically calculated as any check-out time past your configured Standard End Time.
  Printable.
- **What's not included:** facial recognition and fingerprint/biometric scanning need
  dedicated hardware and vendor software that a free, offline, dependency-free system like
  this genuinely cannot provide — so rather than fake it, these two methods aren't included.
  QR and PIN cover the same day-to-day need without special equipment.

### Student login and "My Report Card"
Students can now have their own login, restricted to their own information only — this was
built and then deliberately tested by trying to break it (not just trusting the code): a
student account can see its own report card, profile, fees, and attendance, and is correctly
blocked from every other student's data, the full student list, the whole-class ranking
report, and the whole-school fees report, no matter what's typed into the address bar.

To set one up: **Users & Roles → Add User → Role: Student**, then enter the Student ID
(e.g. `NIB/2026/001`) in the "Linked Student ID" field that appears. That student then logs
in with a short menu: Dashboard, My Report Card, and the Discussion Forum.

### Discussion Forum
A simple topic-based message board for students and teachers — not real-time chat, but
everyone with access sees the same topics and can reply, which keeps it simple and
moderatable for a school setting. Start a topic (optionally tagged to a class/subject), reply
with an emoji picker built in, and delete a topic if needed (admin-level roles only). A
notification banner at the top flags any topic with activity since your last visit.

### Timetable: per-day periods, and Duty Roster
- **Different period counts per day** — e.g. 8 periods Monday–Thursday, 4 on Friday — set
  under the weekday checkboxes in Weekly Schedule Settings.
- **Break/Lunch/Prayer now appear as their own rows in the printed timetable**, positioned
  at the correct point in the day based on their configured time — not just a text summary.
- **Duty Roster**, on the same Timetable page (scroll down): who's on duty — gate, assembly,
  compound, etc. — on each school day, with its own Print button.

### Student ID Cards — redesigned
Rebuilt after reviewing real-world school ID card conventions: a navy/gold header band, a
larger clearly-framed photo, labeled data rows, a barcode-style strip, a signature line, and
the **school logo as a soft background watermark** across the whole card.

### Parent/Guardian information on the Student form
When adding or editing a student, there's now a **Parent / Guardian Information** section
right on that form — no need to visit the Parents page separately first:
- **Search and link an existing parent** by name or phone if they're already in the system
  (useful for siblings sharing a parent)
- **Add a brand-new parent** inline — name, relationship, phone, email, and PTA membership —
  without leaving the student form; it's created automatically when you save the student
- Remove a linked parent at any time with the × on their chip

### Timetable
Under **Timetable** in the sidebar:
- Set the school-wide schedule once: periods per day, which weekdays count as school days,
  period length, school start/closing time, and break/lunch/prayer times and durations
- Pick any class — including Nursery and K.G., since a timetable is just tied to whichever
  class you select — and click into any period to set its subject and teacher
- **Auto-Generate** fills every still-empty period for a class by rotating through the
  subjects you choose, only touching cells you haven't already set by hand
- The system watches for a teacher being booked into two classes at the same time and warns
  you immediately, whether you set a period manually or through Auto-Generate
- **Print** produces a clean, branded timetable for the selected class

### Language / Multi-language support
A language selector sits on the Dashboard (English, العربية, Français, 中文, Deutsch, Español).
Switching language is instant, remembered for next time, and Arabic switches the whole app
shell to right-to-left layout automatically.

**Honest scope:** this translates the navigation sidebar, the Dashboard, and the login/logout
screens — the parts of the system everyone sees on every visit. It does **not** yet translate
every form, table, and report throughout the rest of the app (student forms, results entry,
report cards, etc. remain in English regardless of the language chosen) — fully translating
and reviewing every screen across six languages is a much larger undertaking than could be
done reliably alongside everything else in this update, and deserves its own dedicated pass.

### Dashboard personalization
- Click **Customize** on the Dashboard to choose which stat cards are shown — your choice is
  remembered on that computer
- Upload a background photo for the Dashboard in **Settings** (a soft overlay keeps the stat
  cards readable over any image)
- The Dashboard shows the live system date and time, updating every second

## 10. Assignments, Quizzes, Class-Scoped Forum, and Class Groups

### Assignments, Quizzes & Examinations
Teachers (and admin-level roles) can build assignments, group work, quizzes, or full
examinations under **Assignments & Quizzes**: a title, type, class, subject, optional due
date and instructions, then any number of questions — either written-answer or multiple
choice. Each one can be:
- **Downloaded as an editable Word document** — a real file Word opens and edits natively,
  with the school's name, the question set, mark values, and blank/option space laid out
  ready to print or adjust
- **Assigned to a specific class** — only students in that class see it or can submit to it,
  enforced on the server, not just hidden in the menu
- **Submitted to directly** — students see their assigned work under their own Assignments
  page, answer online, and their teacher sees every submission per question

### Class-scoped Discussion Forum
Topics can now be tagged to a specific class. A student only sees topics for their own class
plus any general (untagged) topics — enforced server-side the same way as assignments, so a
student can't view or reply to another class's topic even by guessing a URL.

### Class Groups & recurring tasks
Under **Class Groups**, a teacher can split a class into named groups (e.g. "Group A"), add
and remove student members, and assign tasks to a group on a Daily, Weekly, Monthly, or
one-time basis. Students see every task assigned to any group they belong to under their own
**My Group Tasks** page.

## 11. Role Permissions, Student Logins, Camera Capture, and SHS School Selection

### Role Permissions now cover every module
The permissions matrix under Users & Roles was missing Discussion Forum, Assignments &
Quizzes, and Class Groups — meaning there was no way to control which roles could access
them. Fixed, and every row now shows the same name used in the sidebar (with a note where a
feature shares its permission with a broader module — e.g. Staff Check-in falls under
"Non-teaching Staff", Timetable and Duty Roster fall under "Classes").

### Teachers can set up student logins
A **Login** button now sits on the Students list, available to Teachers as well as Admins.
It only ever creates or resets a Student-role account tied to that one student — deliberately
not the same as full Users & Roles access, which would let a teacher create accounts with any
role, including Admin. (This was checked carefully: a logged-in student cannot use this to
create or reset a login for any other student, including themselves via a manipulated request
— confirmed with targeted tests, not just by reading the code.)

### Camera capture for passport photos
A **📷 Take Photo** button now sits next to the file upload on the Student, Teacher, and
Staff forms — opens the device camera with a live preview, and the captured frame is resized
and framed the same way an uploaded file would be.

### SHS School Selection (GES placement form)
Under **SHS School Selection**: students rank up to a configurable number of schools (GES has
required anywhere from 6 to 10 in past years — set this under the page's "Number of choices"
control), each with School Name, Code, Category, and Programme. Below that: Programme
Preferences checkboxes, and Parent/Guardian name and phone. A student fills in and saves their
own form from their own login; teachers/admins can look up and manage any student's form by
Student ID. Every form has a clean **Print** view and an **Excel/CSV download**, either for
one student or a whole class at once. (Also checked carefully: a student can only ever read or
write their own record here, even if a request is crafted to name a different student.)

## 12. GES School Register, System Lock, and Menu Reorganization

### SHS School Selection — updated to match the real GES form
After reviewing the actual 2026 GES School Selection Register, the form now matches the real
CSSPS structure: **8 ranked choices** (School Code, Name, Category, Programme Code, Programme,
Day/Boarding for each), Index Number, Residential Location, and on-screen warnings if a
selection exceeds the guideline limits (no more than 2 Category A schools, no more than 3
Category B — both adjustable under Form Settings) or repeats the same school twice.

**A School Database page** (reached via the "📚 School Database" button on the School Selection
page) lets you search/pick a school right on the form instead of typing everything by hand.
It ships with a small starter set of well-known schools — **honestly**: not the full 900+
school official register. While working through the register, hand-transcribing that many
rows risked introducing errors into a form real students submit to WAEC, so instead the page
supports **CSV import** — you can bulk-load the complete official list yourself (GES
republishes it every year, so this is worth doing annually anyway), and re-importing updates
existing entries rather than duplicating them.

### System-wide access lock
Under **Settings**, an admin can set an **expiry date** — once it passes, the *entire system*
(every user, including admins, and login itself) is locked until the correct **unlock token**
is entered. Generate a token any time from the same page; it's shown once, so write it down.
Entering the right token clears the lock and lets you set a fresh expiry/token for next time —
the same cycle repeats indefinitely. This was tested adversarially: confirmed a wrong token is
rejected, the correct token works, and the status/unlock check itself is reachable even while
completely locked out (otherwise nobody could ever recover).

### Menu reorganization
The sidebar is now grouped into collapsible sections — **Students, Parents, Staff, Academics,
Finance, Services, Communication, Administration** — with Dashboard pinned above them. Each
person's collapsed/expanded groups are remembered on their device.

## 13. Kiosk Camera Capture and Canteen Daily Tracking

### Kiosk camera capture
The Check-in/Check-out Kiosk (`/kiosk.html`) now keeps a live camera preview running the whole
time the screen is open, so there's no separate "take photo" step slowing anyone down —
pressing **Check In / Out** captures a frame from that live feed at the exact moment of the
press and attaches it to the attendance record automatically. A small thumbnail confirms the
capture right there on the kiosk screen. If a device has no camera or permission is denied,
check-in still proceeds normally without a photo — it's never a blocker. Captured photos (both
check-in and check-out) now show as small thumbnails in the Staff Check-in attendance report
for admins.

### Canteen — moved to Finance, and rebuilt to work like Attendance
**Canteen** now sits in the **Finance** group in the sidebar, alongside Fees.

The page itself was rebuilt from a simple read-only list into a full daily tracker, the same
shape as Attendance: pick a class and a date, and mark each canteen-paying student **Paid** or
**Not Paid** for that day (with the amount editable per student, in case someone pays a
partial or different amount). Settings — the **standard daily amount** and **which weekdays**
canteen runs — are customizable by an admin. A **Payment History** panel looks up any student
by ID (or a whole class) over a date range, showing paid/not-paid days and the total collected.

## 14. Dashboard, Language, Sponsors, Teacher Login, and Arabic Terminal Report

### Dashboard and language
- Every Dashboard stat card is now clickable — it jumps straight to the relevant page
  (Students, Attendance, Fees, and so on).
- The language switcher moved out of the Dashboard into the top bar, so it's available and
  works correctly from **every** page, not just Dashboard, without bouncing you back to it.

### Sponsor information for orphans on scholarship
The Student form now shows Sponsor Name, Sponsor Organization, and Sponsor Contact — but only
once a student is marked **Orphan** *and* has a Scholarship Status other than "None". The
fields appear and disappear live as those two dropdowns change.

### Teacher login accounts, properly linked
Teachers can now get their own login the same way students can — a **Login** button on the
Teachers list (admin-level only, so teachers can't create logins for each other). This closes
a real gap: previously there was no reliable way for a Teacher's login account to be tied back
to their teacher record, which the next feature depends on.

### Teaching language & Arabic Terminal Report
Teachers now have a **Teaches In** field (English / Arabic / Both). Under the new **Arabic
Terminal Report** page:
- **Fully customizable subject list** — add, edit, or remove subjects (Arabic name, English
  name, category, minimum pass score, maximum score, display order). Ships seeded with the 19
  subjects from the traditional Islamic/Arabic curriculum register (Qur'an memorization,
  Tajweed, Tafsir, Fiqh, Nahw & Sarf, Balagha, and more).
- **Score entry restricted to Arabic-designated teachers** — enforced on the server, not just
  hidden in the menu: a teacher marked "English" gets a flat 403 trying to enter these scores,
  confirmed by direct testing; a teacher marked "Arabic" or "Both" can enter them normally.
- **A professional, right-to-left printed report** modeled on your uploaded register — subjects
  grouped by category with Arabic section headers, the same columns as the original (serial,
  subject, minimum, maximum, score obtained, notes), a totals line, and a signature block.

## 15. Icons, Arabic Head Teachers, and Canteen Collector Assignment

### Custom icons throughout
Every Dashboard stat card and every sidebar nav item/group now uses a real icon extracted
from your uploaded icon set (not generic outline icons). Getting this right took a couple of
tries — the first two attempts at reading the icon grid produced icons with edges of their
neighbors bleeding in, caught by actually looking at the crops rather than trusting the math,
fixed by precisely detecting the real gaps between icons pixel by pixel.

### Arabic Head Teacher role
A new **Arabic Head Teacher** role, assigned to a specific level (Nursery / Primary / JHS /
SHS) when their account is created under Users & Roles. They only ever see the Arabic-teaching
staff at their own level — "the staff under them" — enforced on the server, not just hidden in
the menu. Verified directly: a JHS Arabic Head correctly saw only the Arabic-designated JHS
teachers, not the English JHS teacher and not an Arabic teacher at a different level. Teachers
now also have a **Level** field (alongside the existing Teaches In field) to support this.

### Canteen Collector assignment — now actually usable
The Canteen Collector role and its class-scoped security already existed, but there was no
way to actually *create* one through the interface. Fixed: creating a user as a Canteen
Collector now shows an "Assigned Class" field, and that collector is permanently scoped to
marking payments for only that one class — verified end-to-end.

## 16. Daily Check-in List, Promotion, Pass Marks, and Report Heading Customization

### Daily Check-in / Check-out List
Under **Staff Check-in**, a new "Daily Check-in / Check-out List" shows everyone who's
checked in or out on a chosen date, in a simple chronological list with its own print view —
separate from the broader Attendance Log below it (which covers any date range for auditing
and overtime purposes).

### Student Promotion
A new **Promote Students** page: pick a class to promote from, a class to promote into, choose
which students (select-all or individually), and confirm. This only moves which class each
student belongs to — it doesn't touch their results, attendance, or fee history. Typically
used once, at the end of the third term.

### Term overall pass mark
Each term now has an editable **Overall Pass Mark**, set from Academic Years & Terms. Report
cards compare the student's average against it and show a color-coded **Pass** or **Fail**
result alongside the usual grade and class position.

### Report card heading customization
Under Settings → School Identity, a new "Report Card Heading" section lets you set the
**alignment** (left/center/right) of the logo and school name block, and add **additional
header information** (a GES code, P.O. Box, accreditation number, etc.) shown under the motto.
Applies to report cards.

### Arabic Terminal Report — words per subject, and A5-paired printing
- Every subject's score now automatically writes itself out in **Arabic words** in the
  ملاحظات (notes) column, not just the grand total — alongside any remark a teacher enters.
- A new **"Print All (2 per A4 landscape sheet)"** button prints a whole class's Arabic
  Terminal Reports two at a time, each sized to roughly A5, side by side on one landscape A4
  sheet — the practical way to print a class's reports without one full sheet per student.

## 17. Arabic Report Polish, Menu Themes, Attachments, SBA Sheets, and a Ranking Fix

### Arabic Terminal Report
- Removed the redundant word "درجة" from every auto-generated Arabic-words score (per-subject
  and the grand total) — it's now just the number spelled out, cleanly.
- Student position now shows both the ordinal word and the figure in brackets, e.g. "الأول (١)".
- Larger logo, larger and bolder school name, a double-border frame, and subtle row striping
  for a more professional, certificate-like appearance.

### Color-coded sidebar menu
Each menu group (Students, Parents, Staff, Academics, Finance, Services, Communication,
Administration) now has its own distinct accent color on its header and on every item inside
it, so the sidebar reads as organized sections at a glance.

### Menu color themes
Five selectable presets under Settings — Navy & Gold, Emerald & Cream, Royal Purple, Crimson &
Charcoal, and Ocean Blue — applied instantly and system-wide the moment you pick one, and
remembered for everyone afterward. Since these are the same CSS variables the rest of the
interface already shares, switching themes reskins buttons and highlights throughout the app,
not just the sidebar.

### Performance ranking fix
Students with **identical average scores** are now correctly shown as tied (1st, 1st, 3rd)
instead of being arbitrarily split into sequential positions (1st, 2nd, 3rd) — fixed in both
the whole-class Performance Report and each student's own Report Card position.

### Camera and file attachments — Discussion Forum and Announcements
Both now support attaching a file or capturing a photo directly from the camera when posting —
a reply in the Forum, or a new Announcement. Attachments show as an inline photo (for images)
or a downloadable link (for anything else, up to 8MB).

### SBA (School-Based Assessment) record sheets
The "Print SBA Record Sheet" button on the Continuous Assessment page now generates a proper
class-wide sheet in the GES-standard shape — and, importantly, it now actually reflects
whatever component names, maximum marks, and CA/Exam weighting are configured under Settings ➜
Continuous Assessment Style, rather than always showing the original hard-coded component names.

## 18. Deep Customization, Print Redesigns, and Visitor Tracking

### Fonts and licensing note
8 Arabic display fonts were installed (under `public/assets/fonts/`) and are selectable from
Settings for the Arabic Terminal Report. A few of the source filenames indicate "personal use"
or "trial/demo" licensing — worth checking with the font's creator before heavy production use.
Separately: the three specifically-named fonts requested (Janna LT, 18 Khebrat Musamim, Sultan
Medium) are commercial fonts sold by professional foundries; rather than pull them from
third-party "free download" sites of uncertain legitimacy, they were not bundled. If you
purchase/license those fonts, drop the files in the same way you did with these 8 and they can
be added the same way.

### Deep visual customization (Settings)
- **5 additional whole-page themes** (Classic Light, Midnight Dark, Soft Sand, Cool Mint, Rose
  Blush) on top of the 5 sidebar-only themes from before — background, cards, and text color.
- **Menu text size** (small/medium/large) and an optional **3D-look mouse cursor**.
- **Arabic Report font** — pick which installed font the Arabic Terminal Report prints in.
- Sidebar hover now has a subtle slide animation, matching the lift/scale animation buttons
  already had.

### Timetable — landscape, doubled borders, multi-class printing
- Timetable printouts are now **landscape A4** with **doubled border thickness** for a bolder,
  easier-to-read grid on paper.
- A new **"Print Multiple Timetables"** section lets you tick any number of classes and print
  all of them in one go, each on its own page.
- **Class Groups** can now be printed — a sheet listing every group in a class and its members.

### Continuous Assessment — individual result printing
Each student's row on the Continuous Assessment page now has its own **Print** button, giving a
clean, single-student result sheet that comfortably fits one A4 page — separate from the
existing whole-class SBA Record Sheet for when you only need one student's result.

### Kiosk — Non-Staff / Visitor tracking
The kiosk now has a **"Non-Staff" tab** alongside the staff one, for anyone without a
teacher/staff record — visiting parents, contractors, inspectors — to check in and out with
just their name (and an optional reason for visiting). Unlike staff, the same visitor can check
in and out more than once in a day. Tracked separately, shown in the live kiosk summary
alongside Teachers/Staff, and monitored from a new table on the admin Staff Check-in page.

### Menu icons
Three sidebar items that were missing an icon (Promote Students, Class Termly Report, Arabic
Terminal Report) now have one, picked for the closest thematic fit from the installed set.

## 19. Report Downloads, Whole-Number Scores, and Real Teacher-Class Scoping

### Report cards — Word and PDF downloads
Every report card now has, alongside Print, a **Download as Word** and a **Download as PDF**
button. Both are generated from scratch with no external libraries — the PDF one meant writing
the actual PDF file format by hand (objects, cross-reference table, content stream), the same
spirit as this project's hand-built QR code encoder. Verified by actually rendering the output
file to an image to confirm it's genuinely readable, not just "a file that downloads."

### Whole-number scores everywhere
Report card averages, per-subject scores, and Continuous Assessment/SBA final scores no longer
show one-decimal-place values (e.g. "84.5") — everything now rounds to the nearest whole number.

### Student detail page — Login tab
Clicking a student's name (or "View") opens their full profile, and now includes a **Login**
tab showing their username and account status, with Create/Reset Password actions for staff —
without leaving the page, and refreshing itself the moment the change is saved.

### Real class-teacher assignment and scoping
The Classes form now has a **Class Teacher** field — previously the *idea* of a class teacher
existed in the database and one feature (Class Termly Report) already depended on it, but there
was no way to actually assign one. Fixing that unlocked proper scoping everywhere: a Teacher
account now only ever sees the classes they're assigned to and only the students within them —
enforced on the server, confirmed by directly testing that a teacher assigned to one class gets
a 403 trying to enter results for a different class, and succeeds for their own.

### Teacher Dashboard — "My Classes"
A teacher's own Dashboard now shows a "My Classes" section: student count, group count, and
this term's class average at a glance, with one-click buttons into Results, Students, and
Groups for that class.

### Class Groups — academic progress monitoring
Each group on the Class Groups page now shows a **Progress** section: every member's current
average this term and a group-wide average, so a teacher can spot a group that's falling behind
— not just who's in it and what tasks they've been assigned.

## 20. Arabic Report Polish, Users & Roles by Category, and a Real Teacher Permission Bug

### Arabic Terminal Report
Now includes the **student's photo** (positioned opposite the school logo, gracefully balanced
even when a student has no photo on file) and an **overall grade description** (ممتاز / جيد
جداً / جيد / مقبول / ضعيف / راسب) based on their percentage — shown alongside the existing
percentage line.

### Users & Roles — separated by category
The account list is now split into tabs — **Students**, **Teachers**, **Non-teaching Staff**,
and **Other** (admins, accountants, parents, etc.) — each showing a count, instead of one long
mixed list. Makes it much faster to find, say, which students actually have login accounts.

### A real Teacher permission bug, found and fixed
While working through what a Teacher's dashboard should let them do, testing turned up a
genuine bug: **Teachers had no permission on Announcements at all**, and — more seriously —
opening the **Results** page was silently redirecting them straight back to the Dashboard.
The cause: the Results page needs the list of Terms to populate its dropdown, and Terms sit
under an "Academic Sessions" permission that Teachers had zero access to, so that one failed
request was quietly breaking the whole page. Both are now fixed — Teachers can view (but not
create/edit) terms and academic years, and can view and post Announcements — with a migration
so existing installations pick this up automatically, not just new ones.

### Teacher Dashboard — more to do from one place
The "My Classes" section now has quick buttons for **Assignments & Quiz** and **Post
Announcement**, alongside the existing Enter Results, View Students, and Groups — and the
"Print an Entire Class's Report Cards" section (which a Teacher can now actually reach) covers
viewing and downloading a whole class's results at once, each report individually downloadable
as Word or PDF.

## 21. Individual Dashboards, Global Search, and Verifying What Already Existed

### Individual, per-account dashboards
The Dashboard's "Customize" feature previously saved which stat cards you wanted to see in the
browser's local storage — meaning it wasn't really tied to *you*, just to that one browser. It's
now saved against your actual account, so it follows you to any device you log in from, and two
different people sharing a browser never see each other's choices.

Each role also now starts from a sensible default instead of the same admin-style view for
everyone:
- **Teacher / Arabic Head Teacher** — student counts, attendance, orphan status
- **Student / Parent** — today's attendance, outstanding fees
- **Non-teaching Staff** — student/teacher counts, attendance
- **Accountant/Bursar** — fees collected/outstanding, canteen, students
- **Canteen Collector** — canteen users, students
- **Headteacher, Super Administrator, and other admin-level roles** — the full card set, as before

Everyone can still hit "Customize" to make their own further changes — these are just the
starting points.

### Global search
A search box now sits in the top bar on **every single page**, plus a "Search" entry in the
main menu. Searches Students, Teachers, and Non-teaching Staff at once by first name, last
name, date of birth, contact number, or ID — grouped by category, click a result to jump
straight to it. Respects the same permission and class-scoping rules as everywhere else (a
Teacher searching only ever finds students in their own class).

### Confirmed already working (no changes needed)
A few items from this round turned out to already be fully built from earlier sessions —
verified rather than rebuilt: the New Admissions & Enrolment page's term/date/month/year
filters, the general interface font-size setting (Settings → Menu Size & Cursor → Interface
Text Size, which scales the *whole* app, not just the sidebar), and automatic logout after
5 minutes of inactivity.

## 22. Individual Tasks, Subject Teachers, Performance Trends, and Targeted Discussions

### Two more real Student permission bugs, found and fixed
Testing what a student should be able to do turned up two more of the same class of bug seen
before — a menu item existed, but the permission behind it didn't:
- **"My Fees"** silently redirected students back to the Dashboard, because it reused the full
  admin fee-management page (which needs permissions students don't have). Built a proper,
  simplified read-only "My Fees" view instead — and along the way found the admin page itself
  had a data bug (fee payments live in a separate table and weren't being summed correctly).
- **"Announcements"** had zero permission granted to the Student role at all, despite being a
  visible menu item. Fixed with a migration so existing installs pick this up automatically.

### Subject Teacher assignment
Classes already had a single "Class Teacher" field; there's now also a **Subject Teachers**
list per class (Classes page → "Subject Teachers" button) — a many-to-many relationship, since
one teacher can teach a subject in several classes, and a class can have several subject
teachers alongside its one class teacher.

### Individual student tasks
Teachers can now assign a task or duty to **one specific student** directly from the Students
list ("Assign Task"), without needing to set up a whole Class Group for a single person. The
student sees it (alongside any group tasks) under "My Tasks," with a due date, frequency, and a
"Mark Done" button.

### Performance Report — Student Analysis
A new section compares one student's average score **term-over-term across the whole academic
year** (Term 1 through Term 3), with a hand-drawn line chart (no charting library — built the
same way as this project's from-scratch QR encoder and PDF writer) plus a plain-language
improved/dropped summary and a data table underneath.

### Discussion Forum — targeted discussions and a join widget
- When starting a topic, you can now target it at **Teachers, Students, Parents/Guardians,
  Non-teaching Staff, or Everyone** — enforced on the server, so a targeted topic is invisible
  to accounts outside that audience, not just hidden from their view.
- A row of filter chips (🍎 Teachers, 🎓 Students, 👪 Parents/Guardians, 🧰 Non-teaching Staff,
  🌐 All) sits at the top of the Forum for browsing by category.

### Already confirmed working (verified, not rebuilt)
Student access to Discussion Forum and direct Messages to classmates/teachers were already
built from earlier sessions — confirmed end-to-end, including that a message correctly reaches
the intended recipient's own inbox. Subject Teacher assignment, Class Teacher assignment via
the Classes form, and message contacts correctly listing both classmates and the class teacher
were all specifically re-verified with real accounts after some confusing test results turned
out to be test-environment data pollution rather than actual bugs.

## 23. Dashboard Polish, System Reset, and Assignment Grading

### Dashboard additions
- **Total Subjects** and **Total Classes** stat cards, selectable the same way as the others via
  "Customize."
- **"Students by Class" is now clickable** — click any class row to jump straight to that
  class's filtered student list.
- **Messages** got a proper icon in the sidebar (previously reused the generic "Communication"
  group icon, which looked identical to nearby items).
- Confirmed (already built correctly from earlier work, not something added now): the top bar
  always shows the logged-in user's name and role, and their photo when one exists — falling
  back to their linked teacher/student record's photo if the account itself has none.

### System Reset — Settings → Danger Zone
A new, deliberately hard-to-trigger-by-accident **"Reset & Clear All Data"** button: requires
typing the word RESET to confirm, downloads a safety backup automatically first, then
permanently deletes every actual data record — students, teachers, staff, parents, results,
fees, messages, announcements, everything — while preserving the system's own configuration
(roles, permissions, grading scale, ID formats, theme, the GES reference school list) and the
account performing the reset, so the system stays usable immediately afterward instead of
locking everyone out. Given how destructive this is, it was tested unusually thoroughly before
being considered done: verified the right tables empty and the right ones survive, verified the
acting admin's session and a completely fresh login both still work afterward, and verified the
confirmation gate genuinely blocks submission until the exact word is typed.

### Assignment & Quiz grading
Teachers can now actually grade what students submit — the database already had columns for
this from earlier work, but there was no interface to use them. Under a submission's
"Submissions" view, each answer now has a marks field (capped at the question's maximum) and an
optional feedback field. Once graded, the student sees their total score and per-question
feedback directly on their own copy of the assignment.

## 24. Student Barcodes and a Timetable Addition

### Student barcodes
Every student now gets a genuine **Code128 barcode** (readable by real handheld/USB barcode
scanners, not just cameras) encoding their Student ID — implemented completely from scratch, no
library, in the same spirit as this project's QR encoder and PDF writer. It appears immediately
in the "Student Added" confirmation the moment a new student is created, and on every printed
Student ID Card. Verified unusually thoroughly given it's easy to get a barcode standard subtly
wrong: every one of the encoder's 107 symbol patterns was checked against the Code128
specification's exact bar-width rules, and a full independent decoder was written separately to
round-trip real Student IDs back to their original text — including confirming a deliberately
corrupted barcode is correctly rejected by checksum validation — before ever putting it in front
of a printed card.

### A real bug, found while testing the barcode work
While setting up test data, found that an Assignment/Quiz with no specific class selected (i.e.
meant for every student) was invisible to **every single student** — a strict database check
meant "no class chosen" was being treated as "no one can see this," instead of "everyone can see
this," inconsistent with how the Discussion Forum already handles the identical situation. Fixed
to match that established, correct convention.

### Timetable — Subjects Per Week
The Timetable page now shows a per-class summary of how many periods per week each subject
occupies — a quick sanity check for "does Maths really only have 2 periods this week?"

## 25. Exam Schedule, Overall Pass Mark, and 40 New Themes

### Overall Pass Mark calculator
Academic Years & Terms now has a small calculator: **Total Subjects × Pass Mark Per Subject =
Overall Pass Mark** — handy when a term's pass threshold should be a sum-of-subjects figure
rather than a straight percentage. One click applies the computed result to any term.

### Exam Schedule — a new feature, built end-to-end
A dedicated Exam Schedule (date, time, venue, notes per subject/class/term) — separate from the
day-to-day class Timetable. Teachers get full add/edit/delete; Students and Parents get a
read-only view correctly scoped to their own class. Two real bugs were caught and fixed while
building this:
- A permission design conflict: Exam Schedule was initially going to share Academic Years &
  Terms' permission bucket, which is deliberately view-only for Teachers — that would have
  accidentally stopped teachers from ever scheduling an exam. It now has its own dedicated
  permission module instead.
- The Student view was silently failing (bounced back to the Dashboard) because the page always
  fetched the full Classes and Subjects lists — data a Student has no permission for and never
  actually needed, since they get no filters or add/edit controls. Fixed to skip those calls
  entirely for Students and Parents.

### 40 new color themes, 4 new cursor samples
**20 additional Menu Themes** and **20 additional Page Themes** (25 of each now, up from 5),
plus **4 more 3D cursor color samples** (Navy, Emerald, Ruby, Violet — 6 cursor options total).
All individually verified: correct counts, correct colors on selection, correct persistence
after a reload.

## 26. Camera Barcode Check-in — Found and Fixed a Critical Bug

### The headline: barcode scanning at the kiosk now genuinely works
Discovered that the entire "scan a Student ID barcode at the kiosk" feature — camera capture,
image-to-grayscale-to-bars decoding, checksum validation, professional tabbed kiosk UI — had
already been built in an earlier session. Testing it properly (not just reading the code) found
that **it never actually worked**: every single decode attempt failed, on every barcode, every
time. Traced this down to one specific flaw in the decoder's stop-symbol detection — it assumed
the barcode's ending would be the *exact last 7 runs* in the scanned image data, which is
essentially never true in a real photo (there's always some background beyond the barcode).
Fixed by having the decoder actively check whether a 7-run window decodes to a valid stop
symbol at each position, rather than guessing based on what's left over.

Verified thoroughly before trusting it: confirmed on hand-built pixel data with zero noise,
then confirmed again the way it'll actually be used — rendering a barcode as an image, drawing
it onto a canvas the same way a live camera frame would be captured, and decoding it back — for
several real Student ID formats. All now decode correctly. The manual "type the ID" fallback
(sharing the same check-in logic) was also confirmed working end-to-end at the kiosk.

### Also this session (all individually verified, not just written)
- **Exam Schedule printing and filtering** — turned out to already be fully built; confirmed
  working with a real end-to-end test rather than assumed.
- **Clickable class names** (Dashboard and Classes list, both leading to that class's student
  list) — also already built; confirmed working.
- **Remarks column on report cards** — added to the on-screen/print view, the Word download,
  and the hand-built PDF (which needed its column layout redesigned to fit two new columns).
  A real bug of my own — a duplicate `.join('')` call that would have crashed report card
  rendering — was caught and fixed before it ever shipped.
- **Main menu scroll polish** — smoother scrolling, a styled scrollbar, and a subtle shadow
  separating the fixed header from the scrolling menu beneath it.

## 27. MTN MoMo Payments, ID Card Customization, and Two More Bug Fixes

### MTN Mobile Money — real Collections API integration
A genuine integration against MTN's actual MoMo Collections API (momodeveloper.mtn.com) — not a
simulated "payment succeeded" button. From "My Fees," a student can tap **Pay with MoMo**, enter
their number, and a real approval prompt goes to their phone; the system then polls MTN for the
outcome and automatically records a normal fee payment the moment it's approved. Settings has a
new card for entering the Subscription Key, API User, and API Key, with a clear "not yet
configured" warning until real credentials are in place — this can't be faked, and testing it
honestly reflects that: with placeholder credentials, the system correctly reaches MTN's real
sandbox, gets rejected, and shows that error rather than pretending to succeed.

A real permission gap was caught and fixed while wiring this up: Students correctly have
view-only access to Fees (they shouldn't be able to create fee records) — but that same
restriction was accidentally also blocking them from paying their *own* balance, since paying
isn't the same action as creating a fee record. Fixed with a specific self-pay allowance,
checked on both the button's visibility and the server request itself.

### Student ID Card customization — the missing control panel
The color themes and optional fields (DOB, Blood Group, Emergency Contact) already existed in
the data model and the card itself, but there was no Settings screen to actually change them —
built that missing piece: 6 color themes and 3 show/hide toggles, confirmed by generating a card
and seeing both the new color and the newly-enabled field actually appear on it.

### Two more real bugs found and fixed
- The custom color-palette picker's "Use This Color" button is separate from the color input
  itself — verified this properly (clicking the actual button, not just changing the input) to
  confirm it really does apply and persist.
- "Exam Schedule" and "Messages" were showing as raw internal keys in the sidebar instead of
  proper labels, because this app's menu renders through a translation lookup rather than a
  label field directly, and neither had a translation entry. Fixed.

## 28. Menu Animation

The sidebar now has proper motion: a staggered cascade when it first appears (login, language
switch, or theme change — never on ordinary page-to-page clicks, so it never feels repetitive),
a springy hover/active feel on each item, subtle icon micro-interaction on hover, and smooth
open/close for collapsible groups (previously an instant snap). Verified as genuine CSS
transitions, not just visual guesswork: measured the group panel's height mid-collapse to
confirm it's actually animating rather than jumping, and confirmed each item's stagger delay
increases in the right order.

## 29. Live Class Rooms — Built and Proven Working

A teacher can start a live class with their camera from **Live Class Rooms** on the main menu;
every student in that class sees a "Live now" banner the moment they open the same page, and can
join with one click to watch and listen in their browser — no separate app or plugin.

### How it works, given this app's constraints
Real-time video (WebRTC) normally needs a signaling server — some way for two browsers to
exchange a technical handshake before they can connect directly to each other — which usually
means a WebSocket server. This app has no persistent-connection infrastructure at all (it's
plain HTTP request/response throughout), so signaling instead happens through polling: the
teacher's browser posts its connection offer, the student's browser checks for it every couple
of seconds, answers back, and the two browsers then stream video directly to each other,
peer-to-peer — no video ever passes through this server. A free public STUN server (just a URL,
no account or library needed) helps the two sides find each other if they're not on the same
local network; no TURN server is configured, so this works best on a school's own LAN, which is
the primary use case.

This is a **teacher-broadcasts, students-watch** model — one teacher's camera reaches each
joined student directly — not a multi-way video call, and realistically suits a single class at
a time (roughly up to 8-10 students) rather than a large-scale broadcast, which would need a
real media server.

### Verified as actually working, not just built
This is the kind of feature that can look complete while silently not working, so it was tested
accordingly: two separate browser sessions (one "teacher," one "student"), each with a real
simulated camera, actually logged in, started and joined a live class through the real UI, and
the test then confirmed — not assumed — that:
- both sides' peer connections reached a genuine `connected` state,
- the student's video element received an actual video track, and
- frames were genuinely arriving (checked the video's live playback dimensions, and compared
  two screenshots a fraction of a second apart to confirm the timestamp and motion in the video
  had actually moved — proof of live video, not a frozen frame).

"End Class" was also verified to properly disconnect everyone and clear the "Live now" banner
from the student's view immediately.

## 30. Redesigned Student & Teacher Dashboards, Finance Navigation

### Student and Teacher Dashboards — completely redesigned
Rather than the admin-style stat-card grid, Students and Teachers now land on a focused,
professional dashboard: their photo and profile up top, then a clean grid of clickable cards —
Results, Fees, Live Class (glowing red when a class is actually live right now), Discussion
Forum, Messages, and Tasks for students; My Classes, Assignments & Quizzes, Live Class, Forum,
Messages, and Class Groups & Tasks for teachers. Every card is a real shortcut to that section,
not just decoration — verified by clicking each one and confirming it lands in the right place.

### Navigation reorganized
- **Live Class Rooms** moved from Academics into **Communication**, alongside Announcements,
  Discussion Forum, and Messages.
- **MTN MoMo Transactions** — a new page under Finance giving a full history of every payment
  attempt (pending, successful, or failed), with the student, amount, phone number, and status
  all visible together — not just the ones that succeeded and turned into a fee payment.

## 31. Parent Logins, Role-Based Portal Dashboards, and Several Real Security/Permission Fixes

### Parent/Guardian logins — with the security work that has to come with them
Parents can now be given their own login (a "Login" button on Parents & Guardians, exactly like
Teachers and Students already had) so they can check their ward's results and fees themselves.
Before enabling this, a genuinely important gap was found and closed: **there was no
server-side restriction anywhere stopping a parent from viewing another family's child** — not
on the student list, not on fees, not on attendance, and not on the report card in any of its
three formats (screen, Word, PDF). A single shared authorization check was built and applied
everywhere a student's private data is exposed, then proven with real tests: a parent's student
list shows only their own child, and every attempt to view another child's profile, report
card, or fees comes back blocked.

### Portal dashboards for every role, with admin-configurable widgets
Non-teaching Staff and Parent/Guardian now get the same focused, professional dashboard Teachers
and Students already had — photo, profile, and a clean grid of relevant shortcuts — instead of
the admin-style view. A new screen under Users & Roles lets an admin control exactly which
cards each role sees, verified by toggling one on and confirming it actually appears (and
works) for that role afterward.

### Real bugs found and fixed while building this
- **Live Class Rooms was missing from the entire admin permission matrix** — the backend
  supported per-role permissions for it, but there was no way to actually configure them.
- **`messages` was missing from every master permission-seeding list system-wide** — meaning a
  brand-new install would never grant messaging to any role from the start, silently relying on
  migrations to patch it in afterward.
- Non-teaching Staff and Parent/Guardian had almost no access to Announcements, Forum,
  Messages, or Live Class Rooms — granted properly, with a migration for existing installs.
- **A Parent's "My Child's Results" card was pointing at the admin's bulk results-entry page**,
  which needs permissions a Parent doesn't have — silently bounced them back to the Dashboard.
  Rebuilt the results view to properly serve Students and Parents (including a ward-picker for
  a parent with more than one child), confirmed with real data.
- **The same bug, same fix, for the Fees card** — Parents got the full admin Fees-management
  page instead of a simple view of their own ward's balance. Also fixed the MTN MoMo payment
  endpoint, which only recognized Students paying their own balance — a parent's "Pay with MoMo"
  button would have hit a permission error; now correctly allows a parent to pay their ward's
  fee, confirmed by getting all the way to a real (honest) response from MTN's API rather than
  a permission rejection.

## 32. Backups With Images, Notifications, Profile Pages, and Two Real Print Bugs

### Backup now includes every uploaded image, not just the database
Built a complete ZIP file format implementation from scratch — writer and reader, including a
hand-written CRC32 checksum — since Node has no built-in ZIP support and this app stays
dependency-free, the same approach already used for the PDF writer and barcode encoder. This
got the strongest verification of anything in this project: the system's own independent
`unzip`/`zipinfo` tools (not this app's own code) confirmed the archive is genuinely valid and
passes integrity checks on every file, and then the full round trip was proven for real — a
real student record and a real photo were deleted, restored from backup, the server restarted,
and both came back correctly. Both restore paths (from an existing backup, and from an uploaded
file) now handle the new format while staying backward-compatible with old database-only backups.

### A notification bell
Covers unread Messages, new Announcements, and new Discussion Forum activity in one place in
the top bar — badge count, a dropdown breakdown, click straight through to the right page.

### Parent and Teacher names are now clickable
Opens a real profile page: for a parent, their own details plus every student assigned to them,
each linking into that student's full profile; for a teacher, their details plus every class
they're connected to, correctly distinguishing Class Teacher from Subject Teacher, with student
counts. A routing bug was caught and fixed here — clicking through to "view a student" was
initially sending people to a class-filtered list instead of that specific student's own page.

### Two real print bugs found and fixed
Testing the "print a report card" flow with a realistic 9-subject student revealed it was
silently overflowing onto a second page. The cause: the Print button called `window.print()`
directly on the busy admin Results page, so unrelated content on that page (the CA-entry tools,
the bulk-print section, the grading table) was printing right alongside the report card. Fixed
by opening the report card in its own dedicated print window instead of printing the whole
current page — verified with an actual PDF rendered through Chrome's print engine: genuinely 1
page, correct A4 size. The exact same bug, with the exact same fix, was also found and fixed on
Student ID Card printing.

## 33. Teacher Multi-Subject Assignment, Mobile Fixes, and Dashboard Widget Permissions

### Teacher multi-subject assignment
A teacher could already be assigned to more than one class as a Subject Teacher, but there was
no way at all to assign them to specific subjects — the database supported it, but no screen
ever let an admin actually do it. Added a full add/remove management section to the Teacher
profile page (chips with an × to remove, a dropdown to add). This also feeds the Timetable's
"auto-assign a default teacher per subject" feature, which previously had no way to ever work.

### Phone camera on the Kiosk — a hard constraint, handled honestly
Camera access on a phone requires a secure connection (HTTPS, or `localhost` specifically) —
this is a browser security rule with no code-level workaround. Node has no built-in way to
generate the certificate this would need, and hand-building a full certificate generator from
scratch carries real risk of quietly producing something browsers reject with no visible sign
anything went wrong. Rather than guess, the Kiosk now detects this exact situation and explains
clearly what's happening and what to use instead (PIN/manual check-in), rather than a vague
"camera unavailable."

### Two real mobile bugs found and fixed
- The top bar's search box was present on phones but squeezed by flexbox down to an unusable
  30px wide. Now gets its own full-width row on narrow screens.
- The Messages page's side-by-side contacts+chat layout didn't fit a phone screen at all. Now
  stacks properly — contacts first, a full-width thread once one is picked, with a Back button
  — the same pattern any phone messaging app uses. Verified by actually sending a message
  through it on a simulated phone.

### Portal Dashboard Widget permissions — closed the gap
Dashboard cards previously only checked whether the admin had left a widget switched on for a
role — never whether that role actually had permission for the feature behind it. An admin
could enable, say, the Live Class Rooms card for a role with no access to that module, and it
would show a card that 403s the moment someone taps it. Fixed with a proper check that a card
only ever appears if both conditions are true. Testing this (by deliberately enabling every
widget for a limited-permission role) surfaced a second, genuinely pre-existing bug: Non-
teaching Staff's "My Tasks" card was silently pointing at the full admin Staff Check-in
management page, which they have no permission to view. Removed that broken link, since no real
task feature exists for that role yet.

### Backup upload-and-restore — fixed and proven end-to-end
The restore-from-upload screen existed, but its file picker only accepted `.db` files, silently
blocking the new `.zip` backups (the ones that bundle images) from ever being selected. Fixed,
then proven for real: created a backup, downloaded it, deleted a student record and an image
file to simulate data loss, uploaded the backup back through the actual UI, and confirmed both
came back correctly after the server restarted.

## 34. Hide-Menu Toggle, Staff Profile Panel, and a Real Messaging Gap Closed

### Hide Menu
A toggle in the top bar collapses the sidebar entirely for anyone who wants full screen width —
useful for data entry or a wide table. Persists across page loads until switched back.

### Staff names are now clickable, with a slide-in profile panel
Clicking a Non-teaching Staff member's name opens their profile in a panel that slides in from
the right — photo, details, and (once they have a login) a Send Message button — without
leaving whatever page you were on.

### A real, fairly significant messaging gap found and fixed along the way
Building the "Send Message" button surfaced something bigger than expected: **Super
Administrator, Headteacher, Headmistress, Non-teaching Staff, and Parent/Guardian could not
message anyone at all** — the underlying contacts logic only ever handled Students and
Teachers, so for every other role, Messages was a page that existed but could never actually be
used. This was caught by testing the actual send, not just checking that the button and compose
box appeared — an earlier attempt genuinely failed with a permission error, which is exactly the
gap the test was there to catch. Fixed by extending the contacts logic: administrators and
Non-teaching Staff can now message each other and teachers (deliberately not opened up to every
individual student, since that's a different, more sensitive feature), and a Parent can message
their ward's Class Teacher. Verified the fix work end-to-end (a real message sent and received
through the Staff panel), and separately re-confirmed Student and Teacher messaging — which
already worked — were untouched by the change.

Also fixed along the way: Non-teaching Staff logins previously had no reliable way to be traced
back to the staff record they belonged to (unlike Teachers, Students, and Parents, which all
had this) — added the missing link and a proper "create login" flow matching the existing
pattern for those other roles.

## 35. CSV Fix, QR Connection, and the Dashboard Directory Dropdown

### A real bug found and fixed in the Class List CSV import
Testing the actual round trip (not just "does the button work") revealed that any student name
containing a comma — "Mary, Jane," for instance — was being silently skipped on import, because
the plain comma-splitting parser misaligned every column after it once it hit that comma inside
the quoted name. Replaced it with a proper quote-aware CSV parser, verified with a real name
containing a comma actually importing correctly this time. Also added a genuine **blank
template** download (a clearly-marked example row, for adding brand-new students) separate from
"download current names" (for editing an existing roster), and fixed an edge case where
exporting for a deleted class silently produced an empty file instead of a clear error.

### Connect a Phone or Another Computer — with a real, independently-verified QR code
A new Settings card shows every LAN address this computer answers to, plus a QR code a phone
can scan to connect directly, using this app's own from-scratch QR encoder (no external
service). This got the strongest verification available: decoded the generated QR code with an
entirely separate, real-world QR library (OpenCV) — not this app's own code — and confirmed it
reads back the exact correct address. An admin can also set a custom override address for
setups where auto-detection isn't right, like router port-forwarding.

### Dashboard: Students by Class / Teachers / Non-teaching Staff, one dropdown
The Dashboard's directory card is now a single dropdown instead of a fixed "Students by Class"
table taking up permanent space — switch between Students by Class, Teachers, and Non-teaching
Staff (the latter opening the same right-side profile panel built earlier), all in the same card.

## 36. Kiosk Check-in QR Sign, and an Apple-Like Polish Pass

### Scan-to-check-in QR sign for the Kiosk
The Staff Check-in page now has a QR code that opens the check-in/check-out kiosk directly —
print it and post it at the entrance, and anyone can scan it with their own phone camera
instead of typing a web address. This is separate from each staff member's personal QR card
(still the fastest one-tap option for them specifically); this one is the general "get to the
kiosk" entry point. Verified with the same independent method as the Settings QR code — decoded
with OpenCV (a completely separate, real-world QR library) and confirmed it reads back the
exact correct kiosk address.

### Apple-like polish pass
Found the visual foundation already fairly strong (the San Francisco system font stack, layered
glass-panel shadows, spring-based button animations were already in place from earlier work),
so this pass focused on two genuine, verified gaps rather than redoing what already worked:
- **A refined, thin scrollbar** everywhere content scrolls (the main content area, modals,
  tables, the Messages and notification panels) — previously only the sidebar had this, so the
  default chunky browser scrollbar stood out against an otherwise polished interface.
- **A subtle fade-and-rise transition** on every page change, so navigating between pages feels
  considered rather than an abrupt content swap.

## 37. A Real, Significant Bug Found and Fixed: QR Codes Encoding "localhost"

You flagged that the kiosk QR sign "is not well function" — investigating turned up a genuine,
fairly serious bug, and a bigger one than just that new feature.

**The problem:** every QR code this system generates for checking in — the kiosk sign, and
critically, **every staff member's own personal check-in QR card** — was built from whatever
web address the admin happened to be viewing the page from (`location.origin`). Since the most
natural way to open this system on the school's own office computer is `http://localhost:3000`,
that's exactly what got baked into the QR code. "localhost" means something different on every
device — on the phone doing the scanning, it points at the phone itself, not the school's
server — so a QR code generated this way would fail for anyone scanning it from their own phone,
even though it looked completely correct on screen and even decoded "successfully" as a QR code
(which is why the earlier verification didn't catch it: it confirmed the QR was well-formed, not
that the web address *inside* it was the right one).

**The fix:** all three QR generation paths (the kiosk sign, one person's individual card, and
the bulk "print all cards" tool) now use the school's real network address — the same one shown
in Settings' "Connect a Phone" card — instead of whatever address happened to be in the browser's
URL bar.

**Verified properly this time:** the earlier mistake was verifying that the QR code was
well-formed without checking whether the address inside it was actually correct for a phone to
use. This time, the test deliberately reproduced the real bug scenario — viewing the admin panel
via `localhost`, the most common real-world case — and then independently decoded all three QR
codes with OpenCV (a separate, real QR library) to confirm each one now contains the school's
real network address rather than `localhost`. The underlying check-in link itself was also
re-confirmed working end-to-end, since it wasn't part of this fix and needed to stay intact.

## 38. The Real Fix: Phone Camera Access Now Genuinely Works (HTTPS, Built From Scratch)

The previous "localhost QR" fix addressed one symptom, but the actual root cause was deeper:
phone camera access (`getUserMedia`) requires a secure (HTTPS) connection in virtually every
modern mobile browser, and this system only ever ran over plain HTTP. No code-level trick fixes
that — it's a hard browser security requirement — so this had to be solved properly: the system
now runs a genuine HTTPS server alongside the regular one.

### What was built
Node has no built-in way to generate the TLS certificate this needs, so it's implemented from
scratch: a minimal self-signed X.509v3 certificate generator (RSA-2048, SHA-256), hand-encoding
the ASN.1/DER structures Node's `crypto` module doesn't provide a shortcut for. The certificate
is regenerated automatically only when the detected network address actually changes (cheap, but
no reason to churn it otherwise), and includes the right Subject Alternative Names so it's valid
for whatever address a phone actually connects to. Every QR code the system generates (the
kiosk sign, personal check-in cards, and the Settings "Connect a Phone" card) now points at this
secure address.

### Verified thoroughly, at every layer
Given how each earlier attempt at this had a gap that only surfaced under real conditions, this
one was checked more rigorously than anything else in this project:
- The certificate's structure, extensions, and self-signature were independently validated with
  `openssl` (a completely separate tool from anything in this codebase) — confirmed fully
  correct, and confirmed the private key genuinely matches the certificate's public key.
- A real, live TLS handshake and HTTPS request/response were completed successfully against a
  running instance of the generated certificate.
- On a simulated phone, `window.isSecureContext` was confirmed `true`, and — the test that
  actually matters — the kiosk's camera was confirmed to genuinely initialize and stream live
  video, checked on **all three** kiosk tabs (Staff, Student, Non-Staff), over the real LAN
  address rather than `localhost`.
- **A real bug was found and fixed during this verification, not just the happy path**: the
  first version would crash the *entire server* — taking the working HTTP side down with it —
  if the HTTPS port was ever unavailable for any reason, because a `.listen()` failure in Node
  surfaces asynchronously and isn't caught by a normal `try/catch`. This was caught by
  deliberately blocking the port and watching the server crash, not by code review. Fixed with a
  proper error handler, then re-tested the same way to confirm it now degrades gracefully:
  the HTTP side keeps working, with a clear log message, if HTTPS can't start.

One expected step: the browser will show a one-time "not private" warning on each device the
first time it connects, since this is the school's own certificate rather than one from a public
certificate authority. Tapping "Advanced" / "Proceed" accepts it, and the connection is
genuinely encrypted and secure-context-qualified from that point on. This is normal for any
self-hosted system on a private network — every field in the certificate is otherwise
completely correct.

### Enabling Camera on Phones — quick reference
- **Easiest**: from Staff Check-in, print the "Scan to Open the Check-in Kiosk" sign and post it
  at the entrance — it always uses the correct secure address automatically, so there's nothing
  to type or remember.
- **Typing an address by hand**: use `https://`, not `http://`, followed by the address shown in
  Settings → System & Security → "Connect a Phone or Another Computer" (or in the terminal
  window when the system starts up).
- **The first time on any phone**: the browser will show a warning like "Your connection is not
  private" or "This site is not secure" — this is expected, not a sign of a problem. Tap
  "Advanced," then "Proceed" (wording varies slightly by browser). This only needs to be done
  once per device.
- **If the camera still doesn't work after that**: the PIN / manual Student ID entry on the
  Kiosk page works exactly the same as scanning, with no camera needed at all.

## 39. Teacher Self-Registration, Bulk Fee Assignment, and Two Real Bugs Fixed

### Teacher self-registration invite link
An admin can now generate a one-time link to send a prospective teacher (WhatsApp, email, SMS —
however the school normally reaches people). Opening it lets them fill in their own details —
name, qualification, phone — and set their own username and password, the same fields as the
admin's own "Add Teacher" form, without an admin having to do any of that for them. The backend
for this (invite tokens, expiry, a public registration page) already existed from earlier work,
but the actual "generate a link" button on the admin side didn't — added that, then verified the
complete real flow: generated a link, opened it in a logged-out browser exactly as a new hire
would, submitted the form, confirmed the resulting teacher record has the correct data, confirmed
they can log in with the credentials they chose, and confirmed the same link can't be used twice.

### Bulk fee assignment
Under Fees, pick a class, tick which students a fee applies to (with a Select All), and assign
the same fee type/term/amount to all of them in one action — rather than repeating the same
single-student form over and over for a whole class.

**Two real, separate bugs were found and fixed while building this** — both caught by actually
clicking the button and reading the real failure, not by reviewing the code:
- A routing-order bug: the new endpoint was being intercepted by a more generic handler earlier
  in the request-processing chain, which misread part of the URL as a broken record ID and
  quietly tried to do something else entirely with the request.
- A database API mismatch: the fix for the first bug exposed a second one — code had been
  written assuming a transaction helper that this project's actual database library (Node's
  built-in `node:sqlite`) doesn't provide.

Verified afterward with a precise check: selecting 2 of 3 students in a class and assigning a
fee results in *exactly* 2 fee records at the correct amount — not 3, not 0.

### Academic Years & Terms
Added a "Clear" button for the Overall Pass Mark Calculator, resetting it back to defaults.

## 40. The Real CSV Bug, a Redesigned Upload Panel, and Genuine Timetable Conflict Avoidance

### The actual CSV import bug — found and fixed
The report of "Import Complete, 0/0/0, nothing shows up" turned out to be genuine and specific:
files using old-style **carriage-return-only line endings** (`\r` alone, with no `\n` at all —
still produced by some legacy spreadsheet software, particularly older Mac exports) caused the
entire file to be read as a single line. That one "line" then contained the word "Student ID"
somewhere in it, so it was misclassified as the header row and stripped away — leaving zero
actual data to import, with no error because, from the code's point of view, there was nothing
wrong with an empty list. Reproduced this exactly, fixed the line-splitting to handle all three
line-ending styles (Windows, Unix, and old Mac), and — while checking for it — found and fixed
**the identical bug in a second, unrelated feature** (the Ghana Education Service schools
import), which had the exact same flaw.

### Class List CSV panel — redesigned
A cleaner three-step layout (Choose a Class → Download → Upload & Import) with numbered badges,
connecting arrows, and a proper click-to-browse drop zone that shows the chosen filename and a
clear "file ready" state, replacing the plain, easy-to-miss file input.

### Timetable auto-generation now genuinely avoids conflicts
The previous version would detect a teacher double-booking across two classes and just warn
about it afterward — not what "without conflicting the timing" means. Fixed so a slot is now
left without a teacher (flagged for manual assignment) rather than ever actually double-booking
someone. Verified with the worst-case scenario: one teacher, two classes, identical schedules —
every single slot in the second class correctly came back conflict-flagged and without a
teacher, and a full check across the generated data confirmed **zero actual double-bookings**
existed anywhere.

### Reshuffle button
Added next to Auto-Generate on the Timetable page — regenerates a class's timetable with a
shuffled subject order for a different arrangement, reusing the same conflict-avoidance. Refuses
with a clear message if Auto-Generate hasn't been run for that class yet in the session (nothing
to reshuffle from), verified working correctly once it has.

## 41. A Second Real CSV Bug, Fee Type Management, and a Subject/Teacher Naming Bug

### The second CSV bug — genuinely fixed this time
Your follow-up screenshot ("36 Skipped, every row blank" when every row was actually filled)
pointed to something deeper than the line-ending fix from before. The real cause: the import
assumed a **fixed column order** (Student ID, First Name, Middle Name, Last Name) and read
cells purely by position — so a real school's own spreadsheet, with columns in a different
order, extra columns mixed in, or a single combined "Name" column, would silently misread every
single row. Rebuilt this to genuinely read the header row and match column *names* flexibly —
First/Last in any order, "Surname" as an alternative to "Last Name," a single "Full Name" column
split automatically — and tested five realistic real-world variations, all of which now import
correctly with the right names in the right fields. A file with genuinely unrecognizable columns
now gets a clear, specific error instead of silently skipping everything.

### Fee Types can now be managed properly
Edit and Delete added per fee type, plus a "Clear All" button — both refuse with a clear reason
if a fee type is actually in use by a real fee record, rather than silently corrupting data.

### Class List CSV is now a popup, not a permanent card
A button that opens the same 3-step import flow in a modal, keeping the Students page itself
uncluttered.

### One Subject can now have more than one teacher
A "Manage" button on each subject opens a small panel to add/remove the teachers who teach it —
the same underlying relationship as the Teacher profile page's "Subjects Taught," just viewed
from the Subject's side this time. **A real bug was found and fixed while building this**: the
new feature was accidentally given the exact same function name as an unrelated, pre-existing
feature (the Classes page's own "Subject Teachers" button), and in JavaScript the second
definition silently wins — so the wrong dialog was opening. Caught by actually clicking the
button and seeing the wrong modal appear, not by reading the code; fixed by renaming, then
specifically re-tested the *other* feature too, to make sure the rename hadn't broken it.

## 42. Income & Expenditure, and Confirming Several Features Already Worked

### What was checked and found already complete — no work needed
- **Role Permissions matrix against every menu item** — audited every module the actual
  navigation references (including the separate hardcoded Student menu) against the permission
  matrix. Zero gaps found; earlier fixes this session already closed this out.
- **Clicking a Class name** — already opens a full detail popup with everything asked for:
  student count, the Class Teacher's name, an alphabetically-sorted student roster, the class's
  full timetable, and a "Print (A4)" button. Verified live rather than assumed: deliberately
  created students in the wrong order and confirmed the popup genuinely sorts them correctly,
  confirmed a real PDF renders at true A4 size (it spans 2 pages for a full 8-period timetable,
  which is expected — a real timetable that size is genuinely that long, not the "page leaking
  onto page 2" bug fixed earlier in this project).
- **Portal Dashboard Widgets** — already a clean popup, not an always-visible panel.

### Income & Expenditure — new, under the Finance menu
- **Income is never stored on its own** — it's computed live from real fee payment records
  (including MTN MoMo payments, since a successful MoMo payment already becomes a normal
  fee_payments row once confirmed), so it can never drift out of sync with what actually
  happened. Verified this directly: recorded a real GHS 750 payment through the actual payment
  API and confirmed the page showed exactly GHS 750, then separately recorded a payment tagged
  as MTN MoMo and confirmed it was added to income exactly the same way a cash payment would be.
- Manual expense entry with categories, a category breakdown table, and per-entry delete.
- Weekly / monthly / termly targets an admin can set, with a live progress bar — verified
  switching between periods shows the correct target and correct income/expenditure/profit
  numbers for each one.
- Profit = income − expenditure, shown with color (green when positive, red when negative).

## 43. Class Details Fixes, Income & Expenditure Additions, and a Login Background

### Class Details popup improvements
Student names in the class detail popup are now clickable, opening that student's full profile
directly. While adding this, found and fixed a genuinely fragile piece of code: the "Print"
button stripped non-printable buttons from the output using regex string-matching against the
raw HTML — which silently breaks the moment a new button is added anywhere in that popup (which
is exactly what had just happened: the new student-list export link would have printed by
mistake). Replaced it with a proper approach — clone the actual content and remove
non-printable elements by class — which won't have this same fragility again. Also added a CSV
export button for the class's student list. Verified: clicking a student name navigates
correctly, and the print output now correctly excludes every action button while still showing
the real class data.

### Income & Expenditure: Reset, and specific weekly targets
- **Reset / Clear** — wipes every logged expense and every target back to a blank slate.
  Deliberately does NOT touch real fee or MTN MoMo payment records, since those are genuine
  financial history that a "reset" on this page should never be able to erase.
- **A target for one specific week** (by date, with an optional week number like "Week 3") — on
  top of the existing single recurring weekly figure, for a school that wants a different goal
  for a particular week, like a fundraising push. Verified this correctly overrides the generic
  weekly target for just that week, and that Reset correctly clears it back out.

### Login page background image
Settings now has an upload for a full-screen background image behind the login form, with an
automatic dark tint applied so the login card stays readable regardless of the photo. Verified
end-to-end: uploaded an image, logged out, and confirmed the actual login screen's background
was genuinely set to it.

## 44. Screen Lock, Confirmed Backups, and Color-Coded Dashboard Cards

### Backup folder — checked and confirmed already fully working
Tested the whole thing for real rather than assuming it worked: confirmed the default
`backups` folder is created automatically, then set a custom folder through Settings,
generated a backup, and confirmed it landed in the custom folder while the default one stayed
empty. This was already built and didn't need any changes.

### Screen Lock — new, with a real bug found and fixed
Since this is a web application rather than a desktop program, "locking the desktop" isn't
something Node can do without OS-specific native code — so this is implemented as an app-level
lock instead: a Settings toggle and a 4–8 digit PIN, a "🔒 Lock" button visible only to the
Administrator, and a full-screen lock overlay that survives a page refresh (checked via a
session flag, so reloading the page can't be used to bypass it).

**A real bug was found and fixed during testing, not by reading the code**: entering a PIN,
right or wrong, failed with a genuine server error rather than "Incorrect PIN." The cause was a
simple parameter-order mistake — the password-verification function expects
`(password, salt, hash)`, and this called it as `(pin, hash, salt)` with the last two swapped.
Checked every other place in the codebase that calls this same function to make sure the
mistake wasn't repeated elsewhere (it wasn't), fixed the one occurrence, then re-verified the
complete flow: wrong PIN correctly rejected, right PIN correctly unlocks, and a page refresh
mid-lock correctly stays locked.

### Dashboard summary cards — color-coded by meaning
Every card previously used the same gold accent regardless of what it showed. Now grouped by
meaning: student demographics in blue, staff/people counts in purple, positive attendance/money
in green, absences and outstanding fees in red, and services (bus, canteen) in teal/orange — so
the whole grid is readable at a glance instead of every card looking identical.

## 45. Salaries, Real Income Sources, and Two Destructive-Action Safeguards

### Salaries — Teachers and Non-teaching Staff, feeding straight into Income & Expenditure
Non-teaching Staff can now have a salary amount, same as Teachers already could. A new Salaries
section under Income & Expenditure lists everyone with a salary set, by month, with Paid/Not
Paid status — paying someone logs it as an expense automatically, with no separate step, and
can't be done twice for the same person in the same month by accident.

### Canteen income was never actually counted — now it is
A genuine gap: canteen payments have always lived in their own table, separate from the regular
fee-payment records, and Income & Expenditure's income figure only ever read from the latter —
so canteen money coming in was invisible to this page the whole time. Fixed, and the page now
shows a breakdown of exactly where a period's income came from (School Fees including MTN MoMo,
and Canteen), plus how many students actually paid in each category out of the whole school.

**A bug surfaced while verifying this, but it was in the test itself, not the fix**: the first
attempt to confirm canteen income worked used the wrong API path, so no real payment ever got
created, and the resulting "it's not working" was actually just an empty test. Caught this,
found the correct endpoint, redid the test properly, and confirmed canteen income is now
genuinely picked up correctly.

### Two safeguarded destructive actions
- **Reset All Fees & Clearance** (Fees page) — wipes every fee and payment record school-wide.
  Deliberately harder to trigger by accident than a normal confirm dialog: requires typing
  "RESET FEES" before the button even becomes clickable. Verified the button stays disabled with
  no input or the wrong text, and only enables and works with the exact phrase.
- **Confirmed** the existing Income & Expenditure "Reset / Clear" button already covers exactly
  Income, Expenditure, Profit, and Targets as asked — Profit is calculated from the other two,
  so clearing them zeroes it out too. Reworded its confirmation message to say this explicitly.

### Confirmed still working: Teacher-to-Teacher messaging
Verified end-to-end with two real teacher accounts — logging in as one, confirming the other
appears as a message contact, sending a real message, and confirming it was actually delivered.

## 46. Documents, Class File Sharing, a Spreadsheet Workflow for Results, and a Real Race Condition Fixed

### Confirmed already complete: the Class List menu item
Turned out to already exist from earlier work, matching exactly what was described — a
prominent page showing every class with student count and class teacher, one click into the
full detail popup. Tested live and confirmed working; no changes needed.

### Student Documents
A new "Documents" tab on each student's profile — any file type up to 8MB (birth certificate,
medical note, transfer letter, etc.), with a description field. Verified end-to-end: uploaded a
real file, confirmed it lists correctly, confirmed it's actually downloadable, confirmed
deletion works.

### Teachers sharing files with their class
Added to the existing Class Details popup as a "Shared Files" section. Got the most thorough
security testing of anything in this update, since access control here really matters:
confirmed a teacher can share to a class they actually teach; confirmed a teacher is genuinely
**blocked** (403, checked server-side) from sharing to a class they don't teach; confirmed a
student can view but never upload; confirmed a student can't even view a different class's
files.

### A practical stand-in for "link to Google Sheets" — Continuous Assessment template
A live connection to an actual Google Sheet isn't possible for a system that runs fully
offline, so this delivers the same real workflow instead: download a CSV template (pre-filled
with the class roster and any scores already entered), open it in Excel — or upload it to
Google Sheets yourself if you want to enter it there or share it with someone — then save/export
as CSV and upload it back. Verified thoroughly: downloaded a template, filled in realistic
scores, uploaded it back, and confirmed via a direct database check that both students' scores
were saved correctly with the right final-grade calculations.

### A real, subtle bug found and fixed: race conditions on fast navigation
While regression-testing, two genuine page errors appeared — "Cannot set properties of null."
Traced this to a real pattern across several of the newer features: a function fetches data,
then updates the page with it — but if the person has already navigated elsewhere before that
fetch finishes, the function tries to update an element that no longer exists and crashes.
Fixed in all five places this pattern appeared (income summary, salaries, expense list, student
documents, and class shared files), each now checking the element still exists before touching
it. Re-verified by running the full 39-page regression sweep **five times in a row** — a single
clean run could have been luck, given this was a timing-dependent issue; five consecutive clean
runs is real confidence it's fixed.

## 47. Class List: Moved, Scoped, and Grouped — Plus Clear Buttons

### Class List
Moved from a pinned top-level item into the Academics menu group, where it now sits alongside
Timetable and the rest of the academic tools. A Teacher now sees only their own class (as Class
Teacher) here — checked server-side, not just hidden in the interface — verified with a real
teacher account seeing their own class and nothing else. The page itself is now organized into
four groups — Nursery, Lower Primary, Upper Primary, and JHS — with an "Other" section for any
class that hasn't had a level set yet. This required splitting the old generic "Primary" level
option into distinct Lower/Upper Primary choices; verified with a full spread of test classes
that every group (including the "Other" fallback) renders correctly.

### Clear buttons — Continuous Assessment & Results, and Arabic Terminal Report
Added to both score-entry screens. These reset the fields currently on screen, not anything
already saved to the database — a deliberately conservative interpretation, since a "Clear"
button that actually deletes saved records would be a much higher-stakes feature to build
without an explicit go-ahead. Verified both: filled in real scores, clicked Clear, confirmed the
fields emptied without touching anything already saved.

## 48. Drag-and-Drop Class Groups, and an Upgraded Portal Dashboard

### Drag-and-drop between level groups
On the Class List page, a class card can now be dragged from one level group into another
(Nursery, Lower Primary, Upper Primary, JHS) to reassign its level — a faster alternative to
opening the class's edit form for this one specific change. Restricted to admin-level roles
(the same tier as adding/removing subjects), since reorganizing the curriculum structure isn't
a Teacher-level action. Verified with a real drag: moved a class from Nursery into JHS and
confirmed via the database that its level was genuinely updated, not just moved visually.

### Portal Dashboard Widgets — four new ones, connected to real features
Added Attendance, Exam Schedule, "My Class" (a Teacher's direct link to their own scoped Class
List), and a properly-labeled Assignments widget. That last one fixed a real, pre-existing
mislabeling along the way: a Teacher's Assignments shortcut was previously wired to the "Fees"
widget toggle, meaning an admin turning off "Fees" for the Teacher role would have silently hidden
Assignments instead of anything fee-related — now each toggle controls exactly what it says.
Verified on a real teacher account: all four new widgets appear, and clicking "My Class"
correctly opens their own scoped class view.

## 49. Student ID Card Redesign

### What was found first
The existing ID card was already genuinely well-built — correct CR80 credit-card dimensions
(85.6mm × 53.98mm, the real industry standard), a themed gradient header, watermark, and a
working barcode — so this wasn't a from-scratch rebuild. While scoping a QR-code check-in
option for the card (mirroring the one Teachers and Staff already have), a real architectural
limit surfaced: the underlying check-in-by-token system is currently hardcoded to only look up
Teachers or Staff, not Students, and adding Student support there risked touching shared logic
that Teacher/Staff check-in already depends on and works correctly today. Rather than risk that,
the barcode — which already works for student check-in today via the kiosk's scanner — was kept
as the card's check-in method, and effort went into a safer, still genuinely useful upgrade.

### What was added
A colored corner tab showing the student's level group — Nursery, Lower Primary, Upper Primary,
or JHS — the same four groups from the Class List redesign, so staff can tell a student's age
group apart at a glance without reading the whole card. The photo frame now uses the school's
own accent color instead of a plain white border, and an empty Date of Birth field (when a
student's DOB hasn't been recorded) no longer shows an empty "—" row. Verified the card still
prints at the exact correct physical size after these changes, and confirmed the level tab shows
the right group for a real JHS student.

## 50. Receipts Management, Fee Categories, and a Permissions Audit

### Confirmed already complete: responsive slider / glass-morphism sidebar
Already fully built. Verified live at a real mobile viewport — genuine backdrop blur (checked
the actual computed CSS, not assumed), correct slide-in/out on the hamburger button, closes on
a backdrop tap. No changes needed.

### Receipts — a searchable payment history, with a real bug found and fixed
A new "Receipts" page under Finance: every payment ever recorded, searchable by student name,
ID, or receipt number, filterable by payment method and date range, with a reprint button on
each row. Testing this surfaced a genuine, consistently-reproducing bug (3 out of 3 times, not
a flaky timing issue): the existing receipt-printing code assumed a specific container element
that only exists on the Fees page, so reprinting from this new page crashed every time. Fixed
in two ways — added the missing element to the new page, and made the shared print function
fail safely with a clear error instead of crashing, so a future page reusing it the same way
won't hit this again. Re-verified with the exact sequence that reproduced the bug; confirmed
clean afterward.

### Student fee categories
Fee Types now have a Category (Academic, Transport, Feeding, Boarding, Extra-curricular,
Examination, General) — set via a proper dropdown rather than free text, to avoid the typo'd,
inconsistent categories that plain prompts would invite. The Fees page now shows a
Billed-vs-Collected-vs-Outstanding summary broken down by category. Verified with a real
Transport fee: billed 150, paid 100, correctly showing 50 outstanding.

### Permissions and roles — audited
Re-ran the nav-items-vs-permission-matrix audit from earlier in this project: still zero gaps,
zero dead entries. Went further this time with an actual security check — confirmed none of the
lower-privilege roles (Student, Parent/Guardian, Non-teaching Staff, Canteen Collector) have
edit or delete access to Settings, Users, or Backup — and a positive-case check the other
direction, confirming the Accountant/Bursar role genuinely has full Fees access, matching what
that role needs to do its job.

## 51. Recovered From a Lost Container, Timetable Redesign, and Custom Font Uploads

### A real infrastructure problem, solved first
This session started in a genuinely empty environment — not "context lost," the actual project
files were gone from disk. Recovered the whole thing from the last zip you'd been sent, and
verified it actually started and ran correctly before making any changes, so nothing from all
the prior work was lost.

### Timetable print — redesigned to match the school's own hand-made version
A photo of Nibras's actual JH1 timetable showed a genuinely different layout than what this
system was printing: days down the rows, time periods across the columns (the system had it the
other way round), with Break/Prayers/Lunch as their own dedicated, rotated-text columns spanning
every day — not squeezed into the schedule as interruption rows. Rebuilt this properly. Along
the way, found and fixed two real bugs: a crash from querying a database column that doesn't
exist (the "current academic year" turned out to be tracked differently than assumed), and a
genuine visual bug — overlapping header text in the new special columns, and "WEDNESDAY" getting
clipped in the day-label column. After both fixes, testing caught a third real issue: the result
was spilling onto a wasteful second page with just Friday alone on it. Tightened the sizing
until the whole week genuinely fits on one A4 landscape page, matching the original.

### Custom font uploads — a genuine gap, now closed
Arabic font support already existed, but as a fixed, hardcoded list (which is why several fonts
sent in earlier sessions were already built in). What was missing: a way for an admin to upload
a *new* font and have it actually usable. Built that — upload a .ttf/.otf with a name in
Settings, gated by the same Settings-level permission as everything else that changes the system
for everyone, and it becomes a selectable option right alongside the built-in fonts. Verified
about as thoroughly as this kind of feature can be: uploaded a real font file, selected it,
generated an actual printed Arabic report, confirmed via the browser's own computed styles that
the custom font was genuinely the active font — not silently falling back — and visually
confirmed it was actually rendering in the output.

## 52. Pushed to GitHub, and Made Deployable Online

### GitHub
The project is now under version control and pushed to
[github.com/gozeystudio/gsManagementSystem](https://github.com/gozeystudio/gsManagementSystem)
(the originally-requested `SchoolManagmentSystem_Online` repo wasn't reachable from this session —
neither in the connected-repo list nor at its GitHub URL — so, after checking with you, this repo
was used instead). Added a `.gitignore` so the database file, uploaded photos, TLS certs, and
backups never get committed — only the application code does.

### Online hosting — without breaking the offline install
Requested next: a live, shared web link, not just a code repository. That's a real architectural
question for an app that was deliberately built to keep a school's data on a local machine and
never touch the internet — so before building anything, flagged the tradeoffs plainly (this
system holds children's and families' personal data; the default admin password is printed to
the console, harmless on an offline LAN PC, not harmless in public) and got an explicit answer on
hosting choice, access model, and whether to harden the login first.

Made the codebase deployable to a real cloud host (Render) *without changing offline behavior at
all*: the database, upload, and backup folders now read an optional `DATA_DIR` environment
variable — unset (the offline install's case), everything stays exactly where it always was;
set (Render's case), they redirect to a mounted persistent disk so data survives restarts and
redeploys. Also fixed static file serving so uploaded photos still resolve correctly at `/uploads/`
when that folder lives outside `public/` on a persistent disk, with the same path-traversal guard
verified against the *raw*, unnormalized request path (curl normalizes `../` by default, which
first gave a false "safe" result — caught by re-testing with `--path-as-is`).

Added `render.yaml` (a Render Blueprint — the exact plan, region, persistent disk, and start
command, so deployment is "connect the repo and click Apply" rather than manual dashboard
clicking) and `ONLINE_DEPLOYMENT.md` (plain-language, step-by-step setup instructions, and the
actual current cost — Render's free tier has no persistent disk, so this is a real ≈$7.25/month,
not free; that's stated outright rather than glossed over).

Verified before pushing: full syntax check, then three separate live smoke tests — default
(offline-equivalent) mode, cloud mode with `DATA_DIR` pointed at a stand-in "persistent disk"
directory (confirmed the repo's own `data/` folder was untouched and the stand-in disk was used
instead), and an actual file round-trip through the new `/uploads/` serving path, including the
traversal-guard re-check above.

## 54. Started Converting the Online Deployment to Supabase/Postgres: Authentication

Continuing the multi-school Supabase migration tracked in `SUPABASE_MIGRATION.md` (schema and
the `db-postgres.js` data-access layer were already in place). Before touching any code, measured
the actual remaining scope precisely rather than guessing: 448 separate `db.prepare(...)` calls
across ~120 API endpoints in `server.js`, all currently synchronous SQLite — a genuinely large,
multi-session engineering job, not something to rush through in one pass, especially since one
mistake in the `school_id` scoping added to each query is exactly how one school could end up
seeing another school's data. Flagged this plainly and confirmed the plan (module by module,
starting with authentication) before proceeding.

- **Wired the runtime switch**: `server.js` now loads `db-postgres.js` only when `DATABASE_URL`
  is set (`USE_POSTGRES`); unset, every line behaves exactly as before — verified live, not just
  by inspection (logged in, fetched settings, fetched public-settings, all unchanged with no
  `DATABASE_URL`).
- **Converted authentication end-to-end**: login, logout, session → current-user resolution, and
  the public branding endpoint the login screen reads before anyone signs in. Sessions now carry
  a `schoolId` alongside the `userId` they always carried.
- **Added school resolution for pre-login requests** (`resolveSchoolPg`): an explicit slug, or —
  so a single-school Supabase deployment needs zero frontend changes — automatic detection when
  exactly one school exists so far.
- **Added a safety net for everything not yet converted**: rather than let an unconverted endpoint
  silently run against the local, unused SQLite database and return empty or wrong data once
  `DATABASE_URL` is set — which would look like a data bug, not a missing feature — every `/api/`
  route past login now returns a clear `501` pointing at `SUPABASE_MIGRATION.md` until it's
  actually converted. Verified this doesn't fire at all when `DATABASE_URL` is unset.
- **Re-verified the live Supabase schema** (still matches `001_schema.sql`, 68 tables) and
  re-ran `createSchool()`'s full statement sequence directly against it inside a transaction that
  was then rolled back — confirmed clean, confirmed nothing persisted.
- **Found and flagged a real security gap**: Supabase's advisor shows all 68 tables are exposed
  to anyone with the project's (non-secret) anon key via Supabase's auto-generated REST API. This
  app never uses that API (it connects to Postgres directly, server-side), so enabling Row Level
  Security with no policies would close this off with zero effect on the app — but that's a
  decision for the school to make explicitly, so it's documented with the exact fix rather than
  silently applied.

Honest state of things: authentication works against Postgres (schema- and logic-verified, not
yet exercised against a real `pg` connection over HTTP — this sandbox can't install `pg` or reach
Postgres directly, same blocker noted in `SUPABASE_MIGRATION.md`). Every other endpoint still
needs converting, in the order laid out there. The offline install and the existing SQLite-backed
Render deployment are both completely unaffected either way.

## 55. Converted the Core Student/Class Data to Postgres: 22 Resources at Once

Continued the module-by-module Supabase/Postgres conversion from section 54. The codebase turned
out to already have a shortcut built in: a single generic `crud(table, opts)` factory and a
`resources = { ... }` config object generate full list/get/create/update/delete handlers for 22
tables, all served through one `/api/<resource>[/<id>]` dispatcher — so converting that one
factory and that one ~240-line dispatcher block, instead of converting each table's handler one at
a time, lit up full CRUD for 22 resources in a single pass: `students`, `teachers`, `staff`,
`parents_guardians`, `classes`, `subjects`, `academic_years`, `terms`, `buses`, `fee_types`,
`expenditures`, `weekly_targets`, `fees`, `grading_system`, `announcements`, `duty_roster`,
`exam_schedule`, `live_class_rooms`, `class_groups`, `group_tasks`, `student_tasks`,
`ges_schools`, `arabic_subjects` — the core student/class/academic-setup data the rest of the app
depends on.

- **The `crud()` factory is now backend-aware**: every method takes a trailing `schoolId`; the
  Postgres branch uses `$N` placeholders, scopes every query by `school_id`, and uses
  `RETURNING *`; the SQLite branch is untouched, byte-for-byte.
- **All of the role-scoping rules carried over to both backends**: a Student only ever sees their
  own record; a Parent/Guardian only their own linked ward(s), never another family's child even
  by guessing an id; a Teacher only the classes they're assigned to and the students within them;
  an Arabic Head Teacher only Arabic-teaching staff at their own level.
- **All of the relation and enrichment lookups carried over too**: a student's
  parents/attendance/results/fees/login on `GET /api/students/:id`; a class's teacher name; class,
  subject, and term names attached to `exam_schedule` and `live_class_rooms` rows, including their
  own student/teacher-scoped visibility rules.
- **Added `isConvertedResourceRoute()`**, so the "not converted yet" safety net from section 54
  now correctly lets these 22 resources' routes through in Postgres mode, while every other
  not-yet-converted endpoint still gets the clear `501`.
- **Verified live in SQLite mode** (the one thing this sandbox can fully test): ran real
  create → get → update → list → delete round-trips through the actual running server against
  `classes` and `students` — including the full relation attachment on a student record — plus
  list checks on `grading_system`, `exam_schedule`, `live_class_rooms`, `arabic_subjects`, and
  `ges_schools`. Everything behaved exactly as it did before this conversion, and the test data was
  cleaned up afterward. The Postgres branch is schema- and logic-verified against the live
  Supabase project, same caveat as section 54: actually exercising it over a real `pg` connection
  needs Render or a developer machine, since this sandbox still can't install `pg`.

Also converted **attendance** in the same pass: `GET /api/attendance` and
`POST /api/attendance/bulk` (the daily present/absent marking and its upsert-per-student-per-day
logic) now branch on `USE_POSTGRES`, with `school_id` added throughout and student self-scoping
unchanged. Verified live in SQLite mode: marked attendance for a test student, listed it back
filtered by class and by student, got identical results to before, cleaned up afterward.

Updated `SUPABASE_MIGRATION.md` with the full details and an updated "what's left" list: next up
is results (`continuous_assessment`), then fee payments, then bus/canteen/staff
attendance/communications/reports/audit/backup/settings.

## 56. Large features not yet built

A few requested features are substantial standalone modules that deserve a proper, dedicated
build rather than being rushed in alongside everything else. These are not started:

- **A Library System** — book catalog, borrowing, and returns
- **Performance Analytics** — dedicated charts and trend dashboards beyond the current
  Dashboard and Performance Report
- **"School Resources and Management"** — this needs more definition before it can be built
  (inventory? facilities? asset tracking?) — let me know what you have in mind
- **Full deep translation** of every screen (not just navigation/Dashboard) into all six
  languages, with proper right-to-left layout throughout for Arabic
- **In-system self-upgrade** — uploading a new version through Settings and having the system
  safely replace its own code files while preserving the database and uploads, without needing
  anyone to manually re-copy files. This is a meaningfully riskier build than everything else
  on this list (it touches the running application's own files) and deserves a careful,
  dedicated session rather than being folded in alongside other work.
- **Messages page redesign** — browsing by class to pick a student to message, rather than only
  starting from an existing contact.
- **Student-created friend groups with peer-to-peer group chat** — letting students form their
  own social groups (distinct from teacher-managed Class Groups) and chat within them.
- **Homework** as its own dedicated section, distinct from the general Assignments & Quizzes
  feature.
- **Arabic Terminal Report deep customization** — a watermark image, and broader appearance/
  layout controls beyond the font and color options already there.
- **Topics with Notes, and auto-generating quiz questions from those notes** — this system has
  no AI/LLM available to it (it's a fully offline, zero-dependency Node app), so "auto-generate
  questions" would need to be built as a rule-based/heuristic generator (e.g. turning key
  sentences into fill-in-the-blank or true/false questions) rather than true language
  understanding — worth discussing what quality bar is realistic before building it.
- **Fuller Main Menu customization** — font *style* (a choice of typefaces) and other
  presentation options beyond the size/color/theme controls already in Settings.
- **Settings page reorganized into sub-groups**, with Menu Theme and Page Theme moved from a
  row of swatches into dropdown selectors, to make the now fairly long Settings page easier to
  navigate.
- **Users & Roles permission matrix** — double-check that the newest modules (Live Class Rooms,
  MTN MoMo transactions, Exam Schedule) are all properly represented and labeled there, since
  each was added at a different point and the matrix hasn't had a dedicated pass since.

Tell me which of these to tackle next, and in what order — each is sizeable enough to
warrant its own focused session with proper testing, the same way everything above was built.

---

**Nibras Educational Complex — "Knowledge is Light"**
