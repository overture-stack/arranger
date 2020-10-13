BASH_SCRIPT=`readlink -f ${BASH_SOURCE[0]}`
BASH_SCRIPT_DIR=$( dirname  "${BASH_SCRIPT}")

file_extentions=$(find $BASH_SCRIPT_DIR/../ -type f | grep -v .git | sed 's/.*\///g'  | sed 's/.*\.\([^\.]\+\)$/\1/' | sort  -u)

for ext in $file_extentions; do
	echo "PROCESSING EXTENTION: $ext"
	npx prettier --write **/*.$ext
done
