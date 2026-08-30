# Portable SQON encoding for URLs and citations

Detail for the roadmap entry of the same name. Research notes and measurements, not a plan: the
central question is open and listed at the bottom.

## The two use cases, which are not the same problem

**Shareable links.** A URL pasted into Slack, an email, or a bug report. Read within days, by
someone who can ask a question if it breaks. Wants to be short and ideally legible.

**Citable references.** A portal bookmark printed in a published paper. Read by strangers, years
later, with no way to ask anything. Wants to resolve to the same result set it did on the day it
was written, or to fail loudly.

Compactness serves the first. It does almost nothing for the second, and conflating them is the
main risk in this area.

## Measurements

A realistic SQON, three clauses, one of them a three-value `in`:

| Encoding | Characters | In a URL |
| -------- | ---------- | -------- |
| Raw JSON | 269 | 459 |
| Compact syntax | 118 | 146 |
| gzip + base64url | 219 | 219 |
| brotli + base64url | 184 | 184 |
| Opaque identifier | 12 | 12 |

A heavy bookmark, the shape a paper actually cites: thirty facet values ticked, plus a
three-value second clause:

| Encoding | In a URL |
| -------- | -------- |
| Raw JSON | 1196 |
| Compact syntax | 850 |
| brotli + base64url | 247 |
| Opaque identifier | 12 |

**The two candidates win in opposite regimes, which is the useful finding.** A compact syntax beats
compression on small queries, because gzip and brotli headers do not amortize over a short input.
Compression beats the syntax on large ones, because at that size the payload is field names and
values rather than syntax, and repeated values compress well while a syntax cannot shrink them.

Neither is viable at print length. A URL of 850 characters, or even 247, is unusable as a printed
reference, which points at an identifier for the citation case regardless of what is decided about
syntax.

## Why compactness is not the binding constraint for citations

Two failure modes, neither addressed by any encoding:

- **A field is renamed.** The query still parses and still runs, matching nothing, or matching
  something different. No error is raised.
- **The index is rebuilt or the data is updated.** The same query returns a different result set.
  Defensible behaviour, and not reproducible.

For a citation, silently returning different results is worse than failing, because nothing signals
it to the reader. A durable reference therefore needs provenance (which catalogue, which data
version, resolved when) alongside the query, which is a stored-object concern rather than a
serialization one.

The roadmap's date range aggregation entry already contains one instance of this without naming it:
a relative date resolved at query time means a cited URL returns a different result set every day it
is opened. That is the general problem in miniature, and worth reading alongside this.

## What a compact syntax would have to solve

The shorthand used informally in discussion (`and[in:site['Lung','Breast'],gte:age:40]`) is written
for a human to read, not to round-trip. Four things it does not handle:

- **Escaping.** Values containing a quote, comma, bracket, or colon.
- **Type preservation.** Whether `1` is the number or the string. `modules/sqon` already carries a
  tracked defect from conflating exactly that pair in `checkMatchingArrays`, so a syntax that loses
  the distinction makes an existing problem permanent rather than introducing a new one.
- **Field names that are not identifier-safe.** Hyphens and leading digits are explicitly supported,
  because real mappings contain them, and they need escaping here too.
- **`pivot`, and a version marker.** Nested scoping has no representation in the shorthand at all.
  Any syntax appearing in a citation can never change unless it declares which version it is.

## Prior art worth reading before designing anything

For the syntax: Lucene query syntax and Kibana Query Language both solve the compact-filter-in-a-
string problem, though neither maps cleanly onto `pivot` and nested scoping.

For the citation case: a query permalink is closer to a dataset citation than to a URL, and
scholarly infrastructure already solves "this identifier must resolve in twenty years" through DOIs,
w3id, and PURLs. Worth checking what is already available institutionally before building anything
bespoke.

## Open questions

1. **One mechanism or two?** A compact syntax and a resolvable identifier serve different use cases
   and could ship independently. Deciding they are one feature, or two, shapes everything else.
2. **If an identifier: does it reuse Sets, or is a saved query a separate object?** Sets store a
   resolved membership list; a citable query may want to re-run rather than return a frozen list,
   and those are different data models. The access model for reading a stored query also has to be
   settled before one can back a publicly cited link, since a citation is by definition read by
   people outside the organization that created it.
3. **What provenance travels with a citable reference**, and is it recorded at save time, at
   resolve time, or both?
4. **Is a compact syntax worth it on its own merits**, for legibility and shareable links, even if
   the citation case is solved by an identifier instead? The measurements say it helps most exactly
   where URLs are least painful today, which is an argument for treating it as an ergonomics feature
   rather than a portability one.
