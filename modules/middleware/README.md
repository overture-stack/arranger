#### SQON Filters

Arranger uses a custom JSON object format for filtering that is called SQON (pronounced like "Scone"). SQON provides a flexible system for combining many different filters.

A SQON object consists of nested objects of two types: **Operations** and **Values**.

Operation objects apply boolean logic to a list of operation objects. They are of the form:

**Combination Operation (aka, Boolean Operation)** which groups one or more filters

```
{
  "op":"", //Operation to apply to content ["and", "or", "not"]
  "content":[] //List of Operation objects that the boolean operation will apply to
}
```

OR

**Field Operation** that applies to a filter to Value Object

```
{
  "op":"", //Operation to apply to content ["in", "<=", ">="]
  "content":{} //Value object specifying the field and list of values that the field must be "in" or "not-in"
}
```

**Value** objects specify a list the field name and values for it that the wrapping . This filter can specify to include or exclude fields with any of the listed values. It will have the following format:

```
{
  "field":"", //name of the field this operation applies to
  "value":[] //List of values for the field if using the "in" operation, or a scalar value for ">=" and "<=" operations
}
```

The top level of a SQON must always be a Combination Operation, even if only a single filter is being applied.
