# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## for server side code
use the code code.js and following things 
Run Instructions:

    Save the Code: Save the code above into a file named signaling-server.js on your server.

    Install Node.js and npm: If you don't have them installed on your server, you'll need to install Node.js (which includes npm, the Node Package Manager). You can usually find instructions for your server's operating system on the official Node.js website.

    Install Dependencies:

        Open a terminal or SSH into your server.

        Navigate to the directory where you saved signaling-server.js.

        Run the following command to create a package.json file (if you don't have one already for this project):

              
        npm init -y

            

        IGNORE_WHEN_COPYING_START

Use code with caution. Bash
IGNORE_WHEN_COPYING_END

Install the ws (WebSocket) library:

      
npm install ws

    

IGNORE_WHEN_COPYING_START

    Use code with caution. Bash
    IGNORE_WHEN_COPYING_END

Run the Server:

    From the same directory, run the server using Node.js:

          
    node signaling-server.js

        

    IGNORE_WHEN_COPYING_START

        Use code with caution. Bash
        IGNORE_WHEN_COPYING_END

        You should see the message: StreamHub Signaling Server started on port 3001 (or the port you configured via process.env.PORT).

    Keep it Running (Production Considerations):

        Running node signaling-server.js directly in the terminal is fine for testing. However, if you close the terminal or your SSH session, the server will stop.

        For production, you'll want to use a process manager like PM2, Nodemon (for development), or systemd/init scripts to keep the Node.js application running in the background and restart it if it crashes.

        Using PM2 (Recommended for simple deployment):

            Install PM2 globally: npm install pm2 -g

            Start your server with PM2: pm2 start signaling-server.js --name streamhub-signaling

            You can then manage it with commands like pm2 list, pm2 logs streamhub-signaling, pm2 restart streamhub-signaling, pm2 stop streamhub-signaling.

            PM2 can also help with auto-restarting on server boot.

    Configure Firewall:

        Ensure that the port the server is listening on (default 3001) is open in your server's firewall to allow incoming TCP connections. The command for this depends on your firewall software (e.g., ufw, firewalld, iptables).

        Example for ufw (common on Ubuntu): sudo ufw allow 3001/tcp

#### Update Client-Side URL:

        In your client-side React application (services/signalingService.ts), make sure SIGNALING_SERVER_URL points to your server:

            If testing locally from the same machine: ws://localhost:3001 is fine.

            From other devices on your local network: ws://YOUR_SERVER_LOCAL_IP:3001 (e.g., ws://192.168.1.10:3001).

            For internet access: ws://YOUR_SERVER_PUBLIC_IP:3001 or wss://yourdomain.com/signaling (if you set up a domain and a reverse proxy with SSL, which is highly recommended for wss://). Using wss:// (secure WebSockets) is crucial for production if your main site is HTTPS to avoid mixed content issues.

### Important Notes for the Server:

    Error Handling: This server has basic error logging. For a production system, you'd want more robust error handling and potentially monitoring.

    Security: This is a basic signaling server. For a public application, consider aspects like authentication, authorization, and rate limiting to prevent abuse. Since your client has a password for broadcasting, you might consider passing a token from client to server after password validation to secure who can initiate a broadcast.

    Scalability: This single-instance Node.js server is suitable for a moderate number of users. For very large-scale applications, you'd need to look into distributed solutions and potentially horizontal scaling.

    IDs: The generateUniqueId is basic. For production, using UUIDs (e.g., via the uuid npm package) for client IDs would be more robust to prevent any potential ID collisions if the server restarts.

You should now be able to run this server and have your client application connect to it for multi-user WebRTC streaming! Remember to test thoroughly.