# JSONata Formatter

JSONata Formatter is a web application designed to format and beautify JSONata expressions. This tool provides an intuitive interface for users to input their JSONata code, format it, and copy the formatted output easily.

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
   - Paste your JSONata code into the input area.
   - Click the "Format" button to beautify your code.
   - Use the "Copy" button to copy the formatted output to your clipboard.

## Deployment

To deploy the application to Surge.sh, run the following command in your terminal:

```
bash surge-deploy.sh
```

Ensure you have Surge installed and configured with your account.

## Contributing

Contributions are welcome! If you have suggestions for improvements or features, feel free to open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.