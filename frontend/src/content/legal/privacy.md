This Privacy Policy describes how the RC Car & Rock Crawler Garage & Setup Logger (the "Service") handles information for a hobby community that logs radio-control setup sheets.

Contact: [operators@localhost](mailto:operators@localhost).

## What we collect

When you register we store the callsign, email address, and a bcrypt password hash you submit, plus timestamps for age attestation and legal acceptance. Optional profile fields (bio, https avatar URL) are stored if you add them. Vehicles, electronics, setup telemetry, likes, forks, QR slugs, and content reports are stored so the garage and Scrutineering Desk can function.

## Sessions and local storage

We issue a JWT after login or register. The browser keeps that token in `localStorage` (`rc-garage-auth`). We do not use advertising cookies. Clearing local storage ends the session.

## Google reCAPTCHA

Registration uses Google reCAPTCHA v2 ("I'm not a robot"). Google receives the challenge token and may collect device and usage data as described in Google's [Privacy Policy](https://policies.google.com/privacy) and [Terms of Use](https://policies.google.com/terms).

## How we use information

We use account and telemetry data to authenticate drivers, render garage and feed views, generate chassis QR stickers, and operate moderation (hide, suspend, report queue). We do not sell personal information. There is no marketing mailer in this release.

## Sharing

Public setup sheets, callsigns, and inspection payloads are visible to guests and other drivers. Private sheets stay off the feed and public QR resolver. Moderators and admins can review reported content.

## Retention and deletion

You may delete your account from settings. Operators may retain moderation audit rows with a null actor after deletion so the desk history is not rewritten. PostgreSQL backups taken by the host operator are covered in the operations runbook.

## Contact

Privacy questions: [operators@localhost](mailto:operators@localhost).
