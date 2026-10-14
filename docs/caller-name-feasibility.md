# Caller-name lookup feasibility (Phase 6A)

## Decision

**No provider is confirmed for Phase 6B.** The official documentation reviewed does not establish an API that both performs reverse caller-name lookup and supports Nigerian `+234` numbers. Keep DialScope offline; do not add a provider integration or recommend a vendor on the current evidence.

## Providers reviewed

| Provider | Reverse caller-name API? | Explicit +234 support? | Access and cost | Decision |
| --- | --- | --- | --- | --- |
| [Twilio Lookup v2](https://www.twilio.com/docs/lookup/v2-api) | Yes. Request `fields=caller_name`; the response has `callerName` with `callerName`, `callerType`, and `errorCode`. | **No.** Twilio documents Caller Name as supported only for US carrier numbers; international Lookup/validation support does not extend CNAM coverage. | A Twilio account and API credentials are needed. Basic formatting/validation is free; data packages are paid. The [pricing page](https://www.twilio.com/en-us/user-authentication-identity/pricing/lookup) describes pay-as-you-go pricing and free account signup, but does not list a Nigeria caller-name price because the feature is US-only. No caller-name trial entitlement is documented there. | Not suitable for +234. |
| [Vonage Number Insight](https://developer.vonage.com/en/number-insight/guides/cnam) | Yes. `cnam=true` requests a reverse lookup; fields include `caller_name`, `caller_type`, `first_name`, and `last_name`. | **No.** Vonage explicitly says CNAM is only provided for US numbers. For non-US numbers the CNAM fields are omitted. | Requires a Vonage API key and secret. The API reference says CNAM has an additional charge for US numbers; non-US numbers are not charged for CNAM. No Nigeria-specific caller-name trial is documented. | Not suitable for +234. |
| [Braidis Data API](https://docs.braidisdata.com/api/overview) | The official overview documents a `/caller-id` endpoint for number-to-name lookup. | **Not established.** The published docs reviewed do not state country coverage, including Nigeria. General endpoint availability does not prove +234 caller-name coverage. | The docs mention API-key authentication and a credit cost, but publicly verifiable Nigeria pricing, trial restrictions, and terms authorizing this CLI/open-source adapter were not established. | Not suitable without explicit Nigeria coverage and terms confirmation. |
| [Truecaller developer SDK](https://docs.truecaller.com/truecaller-sdk) | The published SDK documentation describes a user-consented verification/login flow that returns a profile after the user approves. It is not documented as a caller-supplied-number reverse lookup endpoint for this CLI. | No official API documentation found that explicitly confirms reverse lookup for Nigerian numbers. | SDK app registration and platform-specific app metadata are required. The published SDK FAQ describes that SDK as free; that is not evidence of access to a caller-name lookup API. The [API License Addendum](https://www.truecaller.com/api-license-addendum) limits API use and restricts redistribution of API data. | Not a supported fit; no suitable documented +234 API established. |

## Terms and open-source distribution

Twilio's [terms](https://www.twilio.com/en-us/legal/tos/tos-apr-2026) permit its services to be made available to end users as part of software applications, subject to its terms, product documentation, and account responsibilities. This supports the general shape of a user-run CLI integration, but does not establish a right to redistribute caller-name data. The terms do not expressly address publishing a provider adapter under an open-source license. Since Twilio caller-name coverage is US-only, this is not a basis for integrating it for this project's Nigerian use case.

Vonage's API documentation establishes an API and account-authenticated request, but the sources reviewed do not expressly establish that returned CNAM data can be redistributed or authorize a public open-source integration for this use. Its US-only coverage independently rules it out for this phase.

Truecaller's API License Addendum says API content may not be further distributed except under a separate binding written agreement with sufficiently restrictive terms. Its publicly documented SDK is a user-consent verification flow, not the reverse-lookup API needed here. No public terms found establish an open-source CLI distribution right for the requested lookup.

These are product feasibility findings, not legal advice. Any future vendor proposal needs a current written answer on permitted end-user CLI use, returned-data display/retention, and open-source distribution of the adapter.

## Phase 6B gate

Do not begin provider implementation until an official provider source confirms all of the following for Nigerian `+234` numbers:

1. Reverse lookup of a supplied phone number can return a caller name (not only validation, carrier metadata, user login, or user-consented verification).
2. Nigeria is explicitly in the feature's coverage.
3. Developer onboarding, credentials, account approval, pricing, and trial limits are documented.
4. The response schema and no-result/provider-error behavior are documented.
5. Contract terms permit users to call the service from this CLI and permit publishing the integration code under DialScope's MIT license.

If those conditions are later met, Phase 6B should keep lookup opt-in via `--caller-name`, use user-supplied environment credentials, and preserve the current offline path and JSON output exactly when the flag is absent. Results must be labeled **provider-reported caller name**, not verified ownership. The planned explicit statuses are `found`, `not_found`, `unsupported_country`, `missing_credentials`, and `provider_failure`. These are requirements for a later approved provider integration, not behavior implemented in Phase 6A.

## Official sources

- [Twilio Lookup v2 API documentation](https://www.twilio.com/docs/lookup/v2-api)
- [Twilio Lookup pricing](https://www.twilio.com/en-us/user-authentication-identity/pricing/lookup)
- [Twilio Terms of Service](https://www.twilio.com/en-us/legal/tos/tos-apr-2026)
- [Vonage CNAM guide](https://developer.vonage.com/en/number-insight/guides/cnam)
- [Vonage Number Insight API reference](https://developer.vonage.com/en/api/number-insight)
- [Truecaller SDK documentation](https://docs.truecaller.com/truecaller-sdk)
- [Truecaller SDK FAQ](https://docs.truecaller.com/truecaller-sdk/faqs/general)
- [Truecaller API License Addendum](https://www.truecaller.com/api-license-addendum)
