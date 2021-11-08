module.exports = {
    "env": {
        "node": true
    },
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    rules: {
        "no-empty": ["error", { "allowEmptyCatch": true }],
        /* We want these as we have every intention of continuing to use _unusedvar, or things will break. */
        "@typescript-eslint/no-unused-vars": [
            "error",
            {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_",
            },
        ],
        /* The cfgldr hack violates this one and I don't know a way to fix */
        "@typescript-eslint/no-var-requires": [ "off" ],
        /* These are meant to be removed and fixed, unless we move away from TypeScript before then */
        "@typescript-eslint/no-non-null-assertion": [ "off" ],
        "@typescript-eslint/no-explicit-any": [ "off" ],
    }
};
