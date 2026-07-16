# Impleo — Privacy Policy

**Last updated:** 2026-07-17

## The short version

Impleo does not collect your data. There is no Impleo server, no Impleo
account, no analytics, and no telemetry. Everything Impleo knows about you is
stored on your own computer, inside your own browser. The only data that ever
leaves your machine is what you send to the AI provider **you** chose, using
**your** API key, at the moment you ask Impleo to generate an answer.

We — the developers of Impleo — cannot see your profile, your resume, your
answers, or your API key. Not because we promise not to look, but because
there is no mechanism by which that data could reach us. Impleo has no backend
to send it to.

## What Impleo stores, and where

All of it lives in your browser's local extension storage, on your device:

| What | Where it's stored | Leaves your device? |
|---|---|---|
| Your profile (name, contact, education, skills, goals, projects, achievements, resume text, writing sample) | `chrome.storage.local` | Only as part of a generation request to your chosen AI provider |
| Your API key(s) | `chrome.storage.local` | Only to that provider's own API, as the request's auth header |
| Which provider and model you picked | `chrome.storage.local` | No |
| Remembered identity values (e.g. father's name, date of birth, ID numbers) | `chrome.storage.local` | Only as part of a generation request, as described below |
| Learned answers (short answers you accepted or typed) | `chrome.storage.local` | No — these are replayed locally, without an API call |
| Q&A history (last 50 approved answers) | `chrome.storage.local` | Only as tone/context in a generation request |
| Identity documents (resume/CV/portfolio — PDF, DOC, DOCX; up to 3) | `IndexedDB` | **Never.** See "Your documents" below. |
| Which document you last chose per website | `chrome.storage.local` | No |

## What leaves your device, and to whom

Impleo makes network requests to exactly one place: **the API of the AI
provider you configured.** One of:

- `api.anthropic.com` (Anthropic / Claude)
- `generativelanguage.googleapis.com` (Google Gemini)
- `api.openai.com` (OpenAI)
- `api.groq.com` (Groq)

Only the provider you selected is ever contacted. Impleo does not call the
other three, and does not call any other host — no analytics endpoint, no
error reporting service, no update server of ours, nothing.

**What's in that request:** the questions from the form you're filling, plus
the relevant parts of your profile needed to answer them, plus your remembered
identity values, plus up to 3 recent Q&A entries for tone. Impleo deliberately
sends *less* than it could: your resume text and writing sample are only
included when a question actually needs them (an essay question), and are
omitted entirely for forms that only ask for short factual fields.

**Your API key** is sent to that provider as the request's authentication
header, which is the only way an API key can work. It is not sent anywhere
else, ever.

Once your data reaches your chosen provider, **that provider's privacy policy
governs it, not this one.** What they log, retain, or train on is between you
and them — please read their terms. Impleo's role ends at the point the
request leaves your browser.

## Your documents

Your uploaded documents (resume, CV, portfolio) are the strictest case:
**their contents never leave your device at all.**

- They are stored as raw bytes in IndexedDB on your computer.
- They are **never** sent to any AI provider. Impleo does not read them, parse
  them, or include them in any prompt.
- When Impleo needs to decide *which* document to suggest for a form, it ranks
  them using only their **filename and the label you gave them** — never their
  contents. In the rare case it can't decide and asks the AI to break the tie,
  it sends only those filenames and labels.
- A document is only ever attached to a web form when **you click Approve** on
  that specific document, for that specific field. Impleo has no code path
  that can attach a file without that click.

## What Impleo will never do

- **Never auto-submit a form.** Impleo cannot click a submit button. This is a
  hard architectural rule, not a setting.
- **Never fill a field you didn't approve.** Every generated answer passes
  through a review step you control.
- **Never upload a document without your approval**, per the above.
- **Never collect analytics or telemetry.** There is no usage tracking of any
  kind.
- **Never send your data to us.** There is nowhere to send it.

## Permissions, and why each is needed

- **`storage`** — to save your profile, settings, and documents on your device.
  This is the entire storage mechanism; without it Impleo can't remember
  anything.
- **`activeTab` / `scripting`** — to read the questions off the form you're
  looking at, and to fill in the answers you approved. Runs only on the tab
  you're on, only when you click Extract or Fill. Impleo does not scan pages
  in the background or run on tabs you're not actively using.
- **`sidePanel`** — to show Impleo's interface.
- **Host permissions** — to reach your chosen AI provider's API.

## Deleting your data

Everything is local, so you're in full control:

- **Individual items:** Settings has a manager for remembered identity values,
  learned answers, and documents — each can be edited or deleted individually.
- **Everything at once:** uninstalling the Impleo extension deletes all of it.
  Your profile, keys, documents, and history are removed with the extension —
  there is no copy anywhere else, because there was never anywhere else.

Note that exporting your profile creates a plain-text JSON file containing your
profile **and any remembered identity values, which can include sensitive IDs
such as Aadhaar number or date of birth.** That file is yours and lives wherever
you saved it — handle it like you'd handle your resume, or more carefully.

## Changes to this policy

If this policy changes materially, the updated version will be published here
with a new "Last updated" date. Because Impleo collects nothing, changes are
most likely to be clarifications rather than new data practices.

## Contact

Impleo is an open-source project. For questions about this policy, or to report
a privacy concern, please open an issue on the project's repository.
