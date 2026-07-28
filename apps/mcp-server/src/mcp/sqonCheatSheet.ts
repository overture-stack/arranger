/**
 * Compact, LLM-oriented SQON quick reference. Shared by two surfaces: it is the human-readable
 * text of the `get_sqon_schema` tool, and it is sent inline by the `query_arranger` prompt so the
 * grammar is present before the model starts building a SQON. The full machine-readable JSON
 * Schema, operator list, and aliases travel separately in that tool's `structuredContent`, so
 * nothing is lost: this text is the generation guide, the structuredContent is the validation
 * artifact.
 *
 * Smaller LLMs pattern-match examples far more reliably than they "execute" a recursive JSON
 * Schema, so this leads with the single most common mistake (fieldName/value placed beside "op"
 * instead of inside "content"), then gives the Group/Leaf shapes, a copyable leaf template, a
 * build recipe, and natural-language-to-SQON worked examples. Keep it in sync by hand with the
 * SQON schema in `@overture-stack/sqon` (modules/sqon/src/schema): the operator names and node
 * shapes below are derived from it. Every example here is checked against `SqonSchema`.
 */
export const SQON_CHEAT_SHEET = `SQON cheat sheet (Serializable Query Object Notation).
This text is a quick reference for writing the "sqon" filter. The full machine-readable JSON Schema, operator list, and aliases are in the structuredContent of the get_sqon_schema tool.

Grammar:
  SQON  = Group | Leaf
  Group = {"op": "and" | "or" | "not", "content": [ SQON, ... ]}      (content is an ARRAY of child nodes; combines conditions)
  Leaf  = {"op": <field op>, "content": {"fieldName": "<dot.path>", "value": <scalar or array>}}   (content is an OBJECT; one condition)
  Leaf template to copy and fill in:  {"op": "<field op>", "content": {"fieldName": "<field>", "value": <value>}}

Field operators (the "op" of a Leaf):
  in, not-in, some-not-in, all   match value(s); any field type; "value" is a scalar or array
  gt, gte, lt, lte               numeric or date fields; "value" is a single number or date string
  between                        numeric or date fields; "value" is a 2-element array, [min, max]
  wildcard                       case-insensitive substring match; SPECIAL shape: {"op":"wildcard","content":{"fieldNames":["<field>"],"value":"<text>"}}  ("fieldNames" is a plural ARRAY; "value" is one string)

How to build a SQON:
  1. Find each field's path and its allowed operators with get_catalogue_fields.
  2. Write every condition as a Leaf: {"op": <op>, "content": {"fieldName": "<field>", "value": <value>}}, except for "wildcard", where "fieldNames" is an array of field paths instead. (See operator table below.)
  3. Wrap all the Leaves in one root Group: {"op":"and","content":[ <leaf>, <leaf>, ... ]}. Use "or" for any-of, or "not" to negate.
  Always use a Group as the root, even for a single condition.

THE MISTAKE TO AVOID (this is what usually fails):
  In a LEAF, "fieldName" and "value" go TOGETHER inside "content"; "op" stays outside; the key is "fieldName", never "field".
  CORRECT: {"op":"in","content":{"fieldName":"donors.gender","value":["Female"]}}
  WRONG:   {"fieldName":"donors.gender","op":"in","content":{"value":["Female"]}}   (fieldName must be INSIDE content, not beside op)
  WRONG:   {"field":"donors.gender","op":"in","value":["Female"]}                   ("field" should be "fieldName", and nothing is nested in content)

Notes:
  - "value" items are strings, numbers, or booleans.
  - Several allowed values for one field: use one "in" Leaf with an array, e.g. "value":["Female","Male"] (the array means "any of").
  - To negate, wrap a Group {"op":"not","content":[ <leaf> ]}, or use the "not-in" operator on a Leaf.
  - Symbol aliases exist (>, >=, <, <= for gt, gte, lt, lte; = for in; != for not-in) but prefer the word forms.

Natural language to SQON examples:
  Female donors:           {"op":"and","content":[{"op":"in","content":{"fieldName":"donors.gender","value":["Female"]}}]}
  Age over 50:             {"op":"and","content":[{"op":"gt","content":{"fieldName":"donors.age_at_diagnosis","value":50}}]}
  Female and age >= 18:    {"op":"and","content":[{"op":"in","content":{"fieldName":"donors.gender","value":["Female"]}},{"op":"gte","content":{"fieldName":"donors.age_at_diagnosis","value":18}}]}
  Female or age over 65:   {"op":"or","content":[{"op":"in","content":{"fieldName":"donors.gender","value":["Female"]}},{"op":"gt","content":{"fieldName":"donors.age_at_diagnosis","value":65}}]}
  Exclude deceased:        {"op":"and","content":[{"op":"not-in","content":{"fieldName":"donors.vital_status","value":["Deceased"]}}]}
  Age between 18 and 65:   {"op":"and","content":[{"op":"between","content":{"fieldName":"donors.age_at_diagnosis","value":[18,65]}}]}
  Wildcard text match:     {"op":"and","content":[{"op":"wildcard","content":{"fieldNames":["donors.primary_site"],"value":"brain"}}]}
  Everything (no filter):  {"op":"and","content":[]}`;
