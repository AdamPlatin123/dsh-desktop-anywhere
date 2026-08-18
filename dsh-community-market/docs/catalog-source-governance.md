# Catalog source governance and cooperation policy

[中文](catalog-source-governance.zh.md)

Status: Current governance policy for the implemented DSH Community Market. The English and Chinese versions have equal authority.

This policy governs decisions made by Anywhere Labs about source compatibility, reviewed built-in adapters, cooperation labels, and source-related presentation in DSH Community Market. The versioned [catalog provider contract](catalog-provider-contract.md) remains authoritative for wire compatibility, and [Security](../SECURITY.md) remains authoritative for the runtime safety boundary.

This is a maintenance and governance commitment, not a claim that policy is enforced by a moderation service. The Market has no central catalog backend and does not control the contents or governance of an independent provider.

## Commitments

- The standard-source path is open by public contract, not by invitation or a central allowlist.
- Source access and technical review use published, generally applicable criteria.
- Commercial relationships, competition, lawful viewpoints, and protected characteristics do not buy preference or justify exclusion.
- Users choose their own source. There is no default, preferred, hidden fallback, or cross-source ranking.
- A built-in adapter or cooperation label is disclosed as a relationship or technical integration, never as an endorsement.
- Restrictions must be evidence-based, proportionate, scoped to the affected boundary, and open to reconsideration.

## What each source status means

| Status | What it means | What it does not mean |
| --- | --- | --- |
| Standard source | An independently operated source implements the public HTTPS JSON contract. | It is not centrally approved, partnered, recommended, or bundled. |
| User-added registration | A user saved a standard source manifest locally and may explicitly select it. | The source is not listed by or under the control of Anywhere Labs. |
| Built-in adapter | Reviewed and tested local Market code translates a specific existing public API into the normalized contract. | The provider, its catalog governance, and its entries have not thereby passed a security or quality audit. |
| Cooperating source | The source operator and Market maintainers have a disclosed integration relationship. | Cooperation does not make the source default, preferred, official, recommended, or a fallback. |
| Recommendation or endorsement | A separate affirmative trust statement made under separately published criteria. | No current source status, badge, catalog listing, or **Installable** card creates such a statement. |

`built-in` and `cooperating` are separate facts. A local adapter describes how Market reads an API; a cooperation label describes a relationship. Neither changes the user-confirmed source-selection model. The current UI derives a cooperation badge only from a reviewed local built-in provider definition; a remote manifest cannot claim it.

## Open access by contract

Any source that continues to satisfy the published, versioned contract and the generally applicable technical, security, privacy, integrity, and legal requirements may be added and selected by a user without prior approval, a commercial relationship, or a Market code change.

The standard path does not require a provider to join a partnership, use an Anywhere Labs service, submit its catalog for central review, or grant Anywhere Labs editorial control. The Host applies the same schema, transport, provenance, network, and data limits to every standard source. A conforming source may still fail to load because of a temporary network error or an implementation defect; that operational failure is not a governance decision.

Providers whose existing APIs do not implement the standard shape may request a reviewed built-in adapter. Not receiving a bespoke adapter does not exclude a provider from the ecosystem: it may publish the standard contract at any time and use the self-service path.

The Market is federated in ownership and interoperability, not an aggregator in the current v1 product. Sources remain independently operated and share one public boundary, while a browsing session contacts and displays exactly one user-selected source. Market does not silently merge, deduplicate, or rank entries across sources.

## Neutrality and non-discrimination

Anywhere Labs will not deny, degrade, suppress, or condition technical access because a source operator:

- pays, refuses to pay, sponsors, or has no commercial relationship with Anywhere Labs;
- competes with Anywhere Labs, DSH Community Market, or a cooperating provider;
- holds or expresses a lawful viewpoint or political position;
- has a particular nationality, race, ethnicity, religion, sex, gender identity, sexual orientation, disability, or other status protected by applicable law; or
- makes good-faith criticism, performs interoperability testing, reports a vulnerability, or declines a proposed cooperation.

These factors cannot relax the same published requirements either. Code, data, and conduct remain subject to generally applicable technical, security, privacy, integrity, and legal criteria. A payment or sponsorship may fund engineering work, but it cannot buy source selection, priority, fallback behavior, recommendation, weaker review, or a more permissive safety boundary.

Package-level installation decisions are separate from source access. The managed installer may keep an entry browse-only or reject a package under its published identity, integrity, runtime, lifecycle, compatibility, and product-protection rules without removing or penalizing the source that reported it. The current package rules are documented in [Install and uninstall](install-and-uninstall.md).

## User choice and data minimization

- A fresh profile has no selected source. Only an explicit local user action adds or selects one.
- Users may save, reorder, switch, and remove their own source records. A provider cannot select itself or change local priority.
- Except for manifest validation explicitly triggered when a user adds a standard source, only the selected source receives provider-page and media requests. Failure never triggers an undisclosed fallback or a request to another saved source.
- Standard-source requests are anonymous at the application layer: Market sends no ambient cookies, authorization headers, client certificates, or provider-supplied headers. The provider will still receive ordinary network information such as the connecting IP address and request metadata needed to serve HTTPS.
- Market does not treat provider analytics, scores, risk labels, official labels, or featured status as its own claims. Such fields remain provider-owned claims when a reviewed adapter preserves them at all.

Source operators remain responsible for their own privacy notices, logging, metadata rights, content, and legal obligations. Compatibility with this policy or the public schema is not a legal certification.

## Review for a built-in adapter

The standard path has no partnership review. A built-in adapter is different because Anywhere Labs ships and maintains provider-specific code. The review must use source-neutral engineering criteria, including:

- stable public endpoint documentation and representative bounded responses;
- clear attribution, provenance, metadata and media rights, and a responsible contact;
- a fixed and constrained network surface with no remote code, credentials, commands, or configurable mapping logic;
- deterministic normalization into the public contract, including source-local identity and pagination behavior;
- documented rate limits, privacy-relevant request behavior, failure semantics, and provider change notifications;
- automated tests for validation, limits, cancellation, origin control, complete scans, and safe failure; and
- a realistic maintenance owner and cost for code that ships with Market.

Engineering capacity may affect when a bespoke adapter can be built or maintained, but not whether a provider may use the standard self-service path. An adapter review covers Market-owned integration code only. It is not a review of every catalog entry, the provider's organization, or future provider behavior.

The operational intake and release checklist is in the [catalog integration and adapter guide](catalog-adapter-guide.md).

## Relationships and conflicts of interest

When a source is described as cooperating or otherwise receives project-controlled presentation beyond the standard path, the documentation must identify the provider, endpoint or API, adapter type, attribution, and the nature of the integration.

Maintainers must disclose a material relationship that a reasonable user or reviewer would consider relevant to the decision. This includes sponsorship, payment or revenue sharing, ownership or control, employment, and shared governance. Confidential amounts or contract text need not be published, but confidentiality cannot be used to create a misleading claim of independence or neutrality.

A material relationship must not alter compatibility or safety criteria. Where practical, a maintainer with a direct conflict should not be the only person making a final decision affecting the related source or a competitor; the review record should note the conflict and how it was handled.

Provider attribution in a remote manifest is provider-supplied metadata. It does not substitute for an Anywhere Labs relationship disclosure.

## Restrictions and proportionate action

The project does not centrally delist user-owned standard sources. It may reject an individual response, refuse an operation, or suspend or remove project-controlled built-in integration when evidence shows one of the following:

- incompatibility with the published schema, transport, version, or adapter contract;
- a concrete security or privacy risk, including an attempt to bypass user consent or the constrained network and renderer boundaries;
- materially false source identity or provenance, impersonation, data corruption, or manipulation intended to bypass validation;
- serious or persistent resource abuse, instability, or violation of published operational limits;
- insufficient rights or permission required for the proposed integration, including code the project would ship or metadata and media it would reproduce, display, or distribute; or
- a specific obligation under applicable law or a valid legal process.

Action must be based on documented evidence and the same rule used for comparable cases. It should be the narrowest measure that addresses the risk: for example, reject malformed data, leave a package browse-only, disable one unsafe operation, or suspend one built-in adapter instead of disabling unrelated sources or features. The scope and duration should be proportionate, and the restriction should be lifted or narrowed when the stated reason has been corrected or no longer applies. Restoring a removed built-in adapter still follows ordinary review and release.

Removing a built-in adapter does not prohibit a provider from publishing and using a conforming standard source, unless the same source remains blocked by the generally applicable runtime safety or legal boundary.

## Emergency action

For a credible active security threat, immediate platform-integrity risk, or a specific legal obligation requiring immediate action, maintainers may temporarily disable a project-controlled adapter or affected operation before ordinary notice. They must record the time, evidence scope, affected boundary, and reason; notify the operator when it is safe and lawful; review the measure promptly; and lift or narrow it when the emergency reason ends. This describes a project-controlled code, release, or local product boundary; it does not claim a remote kill switch over user-owned sources.

An emergency measure is not a final finding about a source operator, organization, or community.

## Notice and reconsideration

For a non-emergency adverse decision about a built-in adapter or cooperation status, the project should provide a public record—or an appropriately confidential notice when disclosure would create a security, privacy, contractual, or legal risk—identifying:

- the affected provider, manifest, adapter, or operation;
- the published criterion and evidence relied on;
- the scope and effective time of the action;
- any concrete remediation or compatibility path; and
- how to request reconsideration.

Open an issue or pull request in the [DSH Desktop repository](https://github.com/anywhere-labs/deepseek-harness-desktop) for an ordinary governance, compatibility, or cooperation decision. Include the source identity, manifest or API endpoint, the decision being challenged, and relevant technical evidence. Report an unpatched vulnerability privately through [Security](../SECURITY.md), not in a public issue.

Reconsideration uses the same published criteria. Where practical, a maintainer who was not responsible for the original decision should participate. The result and its reasons should be public unless disclosing them would create a security, privacy, contractual, or legal risk. This process does not promise a fixed response time or a built-in appeal interface.

## Policy changes

Changes to this policy should be proposed in a public pull request with matching English and Chinese updates and a plain-language explanation. A technical compatibility change must also follow the versioning rules in the catalog provider contract. Security-sensitive details may be withheld temporarily, but the policy change and non-sensitive rationale should be published when disclosure becomes safe and lawful.
