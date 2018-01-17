import pythonjs from "python-js"

my_python_code = `EQ = '='
NEQ = '!='
IN = 'in'
EXCLUDE = 'exclude'
EXCLUDE_IF_ANY = 'excludeifany'
GT = ">"
GTE = ">="
LT = "<"
LTE = "<="
AND = "and"
OR = "or"
IS = "is"
NOT = "not"`
var code = pythonjs.translator.to_javascript( my_python_code );

console.log(code);