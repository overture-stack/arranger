# Development

This guide covers how to develop or contribute to Arranger Charts. For using Arranger Charts in a React application, see [Guides/Usage](01-Usage.md).

## Local Development

```bash
# Install dependencies
npm install

# Build and watch for changes
npm run dev
```

## Using Local Versions of Arranger Charts & Arranger Components

To develop Arranger modules and see changes in your React app in real-time, you can use `npm link`:

```bash
# in your local Arranger folder
cd modules/charts
npm link
cd ../..
cd modules/components
npm link
```

Then link these packages in your consumer React project:

```bash
# in your local React app
npm link @overture-stack/arranger-charts
npm link @overture-stack/arranger-components
```

To remove these links:

```bash
# in your local React app
npm unlink @overture-stack/arranger-charts
npm unlink @overture-stack/arranger-components
```

## Debug Mode

Enable verbose logging by setting the `debugMode` prop on `ChartsProvider`.
