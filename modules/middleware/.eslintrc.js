module.exports = {
  extends: ["prettier", "prettier/flowtype", "plugin:flowtype/recommended", "react-app"],
  plugins: [
    "flowtype",
    "prettier"
  ],
  rules: {
    "prettier/prettier": [1, { trailingComma: "all", singleQuote: true }],
    "flowtype/define-flow-type": 1,
  },
};
