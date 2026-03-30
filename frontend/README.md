# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run e2e:install`

Installs Playwright browser binaries (Chromium).

### `npm run e2e`

Runs Playwright end-to-end tests for critical journeys:
- auth feedback (login, logout success message, change password forced re-login)
- services
- tasks
- notifications
- orders

### `npm run e2e:auth`

Runs only the mocked Playwright auth smoke suite:
- login
- logout success feedback on the login page
- change password forced re-login
- login again with the new password

### `npm run e2e:integration`

Runs a second Playwright pass in real integration mode:
- frontend on `http://127.0.0.1:3001`
- backend on `http://127.0.0.1:5001`
- real MySQL test database (`NODE_ENV=test`)
- automatic backend migrations + deterministic fixtures

Important:
- this pass recreates the **test DB** before execution
- never point test env variables to a production database

Critical real flows covered:
- auth (real API register + UI login/logout/change password)
- services (read + create)
- tasks (read + create)
- notifications (read)
- orders (read + create)

### `npm run e2e:integration:auth`

Runs only the real-backend auth smoke:
- disposable user registration through the real API against the test DB
- UI login to the dashboard
- logout success feedback on the login page
- change password forced re-login
- login again with the new password

### `npm run e2e:integration:headed`

Runs the real integration Playwright pass in headed mode.

### `npm run e2e:headed`

Runs Playwright tests in headed mode for visual debugging.

### `npm run e2e:ui`

Runs Playwright UI mode.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
