# CPeople — HR-02 presenter guide

**Workshop: Tuesday 24 November 2026, 13:15–14:45 — SMG (Maison Samira Maatouk Morocco)**
**Subject: leave and absence.** Attendance is discussed, not demonstrated: it is
being built and is not ready to show.

Everything in CPeople is **invented data**. The date inside the demo is fixed at
**24 November 2026**, so "this week" and "next month" always mean the same thing.

**What works today, and is what this script sticks to:** leave types and rules,
requesting leave, N+1 and N+2 approval, refusal with a comment, the calendar,
balances, and the self-service settings.

**What to say if asked for anything else:** *"That is next — attendance import,
exceptions and timesheets. We will show it as soon as it holds together, and
the questions at the end of this guide are what we need from you to finish it."*

## Demo accounts

Open each one in **its own Chrome profile**, signed in before the meeting
starts. Four windows, four people; never sign out and back in during the demo.

| Name | Email | Password | Role | Chrome profile |
|---|---|---|---|---|
| **Salma Benali** | `hr@smg-demo.test` | `CPeople-Test-2027!` | HR administrator — the whole company, all settings, the audit log | **HR Salma** |
| **Rachid Kettani** | `manager@smg-demo.test` | `CPeople-Test-2027!` | Manager — the **12 Kitchen** people only; private fields masked | **Manager Rachid** |
| **Karim Alaoui** | `employee@smg-demo.test` | `CPeople-Test-2027!` | Employee — his own file and his own leave | **Employee Karim** |
| **Amina Admin** | `admin@smg-demo.test` | `CPeople-Test-2027!` | Administrator — everything HR sees, plus the organisation | **Admin Amina** |

These are local test accounts on this laptop with invented data. The passwords
are written here on purpose; there is nothing real behind them.

**Setting up a profile:** Chrome → profile icon (top right) → **Add** → name it
as above → open `http://localhost:3000` → sign in → leave the window open.

**Language:** every window has an **EN / FR** button at the top right. Salma and
Karim open in **French**, Rachid and Amina in **English**. That is deliberate —
it shows the same screen in both languages without anybody switching.

**Before you start, check in the Salma window:** Home shows **44 employees**,
**4 people away this week**, **6 leave requests waiting**. If any of those three
numbers is different, the data has drifted — say so, and carry on; the script
still works.

## Leave: the script

Five minutes, four windows. Say what you are about to do before each click.

### 1 · Karim asks for leave — *Karim's window*

| Click | What appears |
|---|---|
| **Leave** in the left menu | His own leave: **My balance** at the top, his requests below |
| **Ask for leave** | The form: type, first day, last day, the two half-day boxes, reason |
| Type of leave → **Annual leave** | |
| First day → **15/03/2027**, Last day → **17/03/2027** | |
| Reason → *"Family visit"* | |
| **Send the request** | **Sent.** and the request's own page |

**Say:** *"Three working days. It was counted when it was sent, and the count is
kept with the rule, the working week and the public holidays that produced it —
so in a year's time anybody can still see why it was three."*

Point at **How the days were counted** → *When it was sent · 3*.

**Say:** *"The reason he typed stays here. It is never put in an e-mail."*

### 2 · Rachid approves — *Rachid's window*

| Click | What appears |
|---|---|
| **Leave** → the **To approve** tab | The requests waiting for him, with a count on the tab |
| **Open** on the row that says *With the manager* | The request, with **Approve** and **Refuse** |
| **Approve** | **Done.** and the request leaves his list |

**Say:** *"He only sees his own team. Who approves comes from your organisation
chart: the manager, then the manager's manager."*

### 3 · The second approval — *Rachid's window, same tab*

The **To approve** tab also holds a request marked **With the second approver** —
unpaid leave, which needs two yeses.

| Click | What appears |
|---|---|
| **Open** on the row that says *With the second approver* | The same screen |
| **Approve** | **Done.** |

**Say:** *"Unpaid leave is set to need N+2. Which types need a second approval is
a switch per type, not something in the code — that is a question for you."*

### 4 · The calendar and the balances — *Salma's window*

| Click | What appears |
|---|---|
| **Leave** → the **Calendar** tab | The month, one row per person, one column per day |
| | Letters show the kind of leave; **hatched** means still waiting; blue is a public holiday; grey is a day nobody works |
| **Leave** → the **Balances** tab | Every person: brought in, carried, earned, long service, taken, waiting, left |

**Say (calendar):** *"A letter, not just a colour — this has to be readable
printed in black and white."*

**Say (balances):** *"No number here was typed in. Every one is worked out from
what was brought over, what has been earned, what has been taken, and HR's own
adjustments — each with a reason, kept for good."*

### 5 · HR sees everything — *Salma's window*

| Click | What appears |
|---|---|
| **Leave** → **All requests** | Every request in the company, whatever state it is in |
| **Open** any approved request | The full history: who asked, who approved, when |

**Say:** *"HR can also decide a request in place of the line manager. That is
recorded as an HR decision with a reason, and shown on the request — stepping in
is visible, not invisible."*

### 6 · A refusal with a comment — *Rachid's window*

| Click | What appears |
|---|---|
| **Leave** → **To approve** → **Open** on a waiting row | The request |
| **Reason** → *"The outlet is at its busiest that week — please take it in January."* | |
| **Refuse** | **Done.** |

Switch to **Karim's window** → **Leave** → the request now reads **Refused**,
with the comment underneath.

**Say:** *"The reason goes back to the person who asked. They are told by e-mail
too — in their own language, with a link and no reason text in it."*

## Rules: everything is a setting

The point of this section: **nothing legal is written into the software.**

### /settings/leave — *Salma's window → Settings → Leave*

Five tabs, each with its own address:

| Tab | What to point at |
|---|---|
| **Leave types** | Paid or not, counted in working or calendar days, half-days, needs a document, needs N+2, keeps a balance |
| **Rules** | Days a year, earned per month, carried over, notice expected, how far back it may be dated — **each row effective from a date** |
| **Working week** | Per site. The outlet trades on Saturday; the head office does not |
| **Public holidays** | Entered, never calculated, per year — plus **"Holidays complete for 2027"** |
| **Policy** | The warning threshold when too much of a department is off at once |

**Say, pointing at the orange banner:** *"Every figure on these screens is a demo
value waiting for you and your payroll expert. Nothing here is legal advice, and
the software says so on every screen until you confirm it."*

**Show the history:** on **Rules**, click **Change** on *Annual leave*. Under the
form is **Earlier rules**.

**Say:** *"Changing a figure writes a new row from the date you choose. The old
one stays, so a balance worked out last year can still be explained."*

### /settings/self-service — *Salma's window → Settings → Self-service*

| Switch | What to say |
|---|---|
| **Employees can see their base salary** | *"Off by default. When it is off the figure is not sent to the employee at all — it is not merely hidden on the screen."* |
| **Colleagues' absences name the kind of leave** | *"Off by default. The calendar says somebody is away, not that it is sick leave."* |
| **Employees can correct their own contact details** | *"On. Telephone and e-mail, nothing else."* |

**Live demonstration, if there is time (90 seconds):** tick **Employees can see
their base salary** → **Save the settings** → switch to **Karim's window** →
**Employees** → **Open Karim Alaoui** → **Pay and bank** → the figure is there.
Untick it afterwards.

## Questions for SMG

These are the answers we need to finish HR-02. Write the answers on the
decisions board as you go; they go into the minutes.

**1 · Leave types.** Which types does SMG actually use beyond the legal ones, and
what is each one worth? We have seeded twelve, all marked "to confirm".

**2 · The approval flow — and who approves outlet staff.** Is it always the line
manager then their manager? Which types need the second approval? **Who approves
the outlet staff?** Should short requests — under two or three days — stop at the
first approver?

**3 · Attendance: the device.** Which make of device, which provider, and who is
our contact there? **We need a sample export file.** Target date **15 December**.

**4 · The fallback.** If the export is late, go-live uses manual entry: HR enters
a week for a department in a couple of minutes. **Is that acceptable?**

**5 · The employee number.** It is the biometric device id. What is the format —
how many digits, are there leading zeros, is it unique for ever? We accept
anything today and warn when it looks wrong.

**6 · Overtime and shifts.** The threshold (daily, weekly or both), rounding,
and whether work on a holiday is paid as overtime or taken back as rest. Which
shifts and which weekly rest day per department?

**7 · Salary visibility.** May employees see their own base salary in CPeople?
Yes or no — it is a switch, and it is off today.

**8 · Public holidays 2026–2027.** Please confirm the fixed dates we have, and
tell us who maintains them from 2028. The moveable religious holidays are
entered each year — they are never calculated.

## If something breaks

Nothing here needs a developer. Three rules:

**1 · Go back to Home.** Click the CPeople logo, top left. Almost everything
recovers by itself.

**2 · Move to the next screen.** Do not debug in front of the client. Say
*"I will come back to that"* and carry on — the rest of the script does not
depend on the step that failed.

**3 · If a window looks signed out,** reload the page. If it asks for a password,
the account is in the table at the front of this guide.

| What you see | What to do |
|---|---|
| A figure shows **—** | The page could not reach the API. Reload once; if it persists, move on |
| A screen is slow the first time | Normal — this is a development build compiling the page. It is fast the second time |
| A number is not what this guide says | The demo data has drifted. Say so plainly and carry on; nothing else breaks |
| The browser is on the wrong account | You are in the wrong Chrome window. Check the name at the top right |

**Never** reset the demo data in front of the client, and never open a terminal.

**If asked something this build cannot answer:** *"It is not built yet — I would
rather show you nothing than a screen that pretends. It is on the list, and the
answer to question N above is what unblocks it."*
