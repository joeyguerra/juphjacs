export class ErrorHandler {
    constructor() {}
    
    async handle(req, res, error = null) {
        // ErrorHandler is the terminal handler - always returns true
        
        if (res.headersSent) {
            return true
        }
        
        let statusCode = 404
        let message = 'Not Found'
        
        if (error) {
            if (error.code === 'ENOENT') {
                statusCode = 404
                message = 'Not Found'
            } else if (error.code === 'METHOD_NOT_ALLOWED') {
                statusCode = 405
                message = 'Method Not Allowed'
            } else {
                statusCode = 500
                message = 'Internal Server Error'
            }
        }
        
        res.writeHead(statusCode, { 'Content-Type': 'text/html' })
        res.end(`<!DOCTYPE html>
<html>
<head>
    <title>${statusCode} ${message}</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 600px;
            margin: 100px auto;
            padding: 0 20px;
            text-align: center;
        }
        h1 {
            font-size: 72px;
            margin: 0;
            color: #333;
        }
        p {
            font-size: 24px;
            color: #666;
        }
        code {
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <h1>${statusCode}</h1>
    <p>${message}</p>
    ${error && statusCode === 500 ? `<p><code>${error.message}</code></p>` : ''}
</body>
</html>`)
        
        return true
    }
}
