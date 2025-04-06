# JSONata Formatter

JSONata Formatter is a web application designed to format and beautify JSONata expressions. This tool provides an intuitive interface for users to input their JSONata code, format it, and copy the formatted output easily.

## Features

- **Auto-formatting**: Formats JSONata expressions automatically after typing stops (800ms delay)
- **Syntax highlighting**: Uses Prism library to highlight formatted code
- **Dark mode support**: Automatically detects system preference and remembers user settings
- **Responsive design**: Works well on both desktop and mobile devices
- **Copy functionality**: Easily copy formatted code to clipboard
- **User feedback**: Toast notifications provide clear feedback on actions
- **Comprehensive formatting**: Handles strings, built-in functions, keywords, path operators, and more

## Project Structure

The project consists of the following files and directories:

```
jsonata-formatter
├── public
│   ├── index.html        # Main HTML document for the application
│   ├── styles
│   │   └── main.css      # CSS styles for the application
│   ├── scripts
│   │   └── main.js       # JavaScript code for the application
│   └── assets
│       └── favicon.ico    # Favicon for the application
├── README.md             # Documentation for the project
└── surge-deploy.sh       # Script to deploy the application to Surge.sh
```

## Getting Started

To get started with the JSONata Formatter, follow these steps:

1. **Clone the Repository**: 
   ```
   git clone <repository-url>
   cd jsonata-formatter
   ```

2. **Open the Application**: 
   Open `public/index.html` in your web browser to access the JSONata Formatter.

3. **Using the Application**:
   - Paste your JSONata code into the input area
   - The application will automatically format after you stop typing
   - Alternatively, click the "Format" button to manually trigger formatting
   - Use the "Copy" button to copy the formatted output to your clipboard
   - Toggle between light and dark modes using the button in the top-right corner
   - Access the JSONata website reference via the link button

## Deployment

To deploy the application to Surge.sh, follow these steps:

1. **Install Surge** (if not already installed):
   ```
   npm install --global surge
   ```

2. **Edit the deployment script**:
   Open `surge-deploy.sh` and update the deployment URL. The current URL in the script is specific to the original repository owner. Replace it with your preferred Surge subdomain:
   ```bash
   # Change this line in surge-deploy.sh
   surge ./public your-chosen-subdomain.surge.sh
   ```

3. **Run the deployment script**:
   ```
   bash surge-deploy.sh
   ```

4. **Log in or create an account**:
   If this is your first time using Surge, you'll be prompted to create an account or log in with your email and password.

Your JSONata Formatter should now be accessible at your chosen Surge.sh subdomain.

> **Note:** Special thanks to [Surge.sh](https://surge.sh) for providing excellent static web hosting services that make deploying projects like this simple and efficient.

## Contributing

Contributions are welcome! If you have suggestions for improvements or features, feel free to open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.