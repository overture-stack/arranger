// GQL field name to Arranger extended mapping JSON field name
export const toJSONFieldName = (fieldName: string) => {
	return fieldName.replaceAll('__', '.');
};
