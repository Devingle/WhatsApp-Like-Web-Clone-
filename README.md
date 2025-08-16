# WhatsApp-Like Chat Application

This is a full-stack chat application inspired by WhatsApp. It features real-time messaging, file sharing, and a clean user interface built with React and Material UI on the frontend, and a Node.js/Express backend with MongoDB storage and Socket.io for real-time communication.

## Table of Contents

Overview

Features

Technologies Used

Getting Started

Prerequisites

Backend Setup

Frontend Setup

How It Works

Project Structure

Usage

Available Scripts

Contributing

License

Author

## Overview

This project is a WhatsApp-style chat application designed for real-time communication. The backend stores messages and user chat data in MongoDB and exposes RESTful APIs for message management. It uses WebSockets with Socket.io to deliver real-time updates, such as new messages, message deletion, and typing notifications. The frontend is a responsive React app styled with Material UI, enabling smooth chat experiences on both desktop and mobile.

## Features

Real-time messaging using Socket.io

Chat list sidebar with search and unread message counts

Single chat view with message bubbles for text, images, audio, and file attachments

Message status indicators (sent, delivered, read)

Add new chats manually by WhatsApp ID

Delete individual messages or entire chats

Dark mode toggle for comfortable use at night

File attachment and media preview in chat

Typing indicator for real-time feedback

Responsive design for mobile and desktop

Backend webhook endpoint for integrating with WhatsApp API or testing with sample payloads

## Technologies Used

Backend
Node.js with Express.js — REST API server

MongoDB with native driver — Database for storing messages and user data

Socket.io — Real-time bidirectional communication

node-fetch — Making HTTP requests internally (for testing payloads)

CORS & dotenv — Configuration and cross-origin support

Frontend
React with hooks (useState, useEffect, useRef, useMemo, useCallback)

Material UI — UI components and styling

Socket.io-client — Real-time updates from backend

JavaScript (ES6+)

## Getting Started

## Prerequisites

Node.js v14+ installed

MongoDB instance running (local or cloud)

npm or yarn package manager

## Backend Setup

Clone this repository and navigate to the backend folder (if separated), or root if combined.

Create a .env file in the backend root with the following content:

text
MONGODB_URI=your_mongodb_connection_string
PORT=3000
Replace your_mongodb_connection_string with your actual MongoDB connection URI.

Install dependencies:

text
npm install
Start the backend server:

text
npm start
The backend server runs on http://localhost:3000 by default.

## Frontend Setup

Navigate to the frontend folder.

Install dependencies:

text
npm install
Start the React development server:

text
npm start
The frontend will open in your browser at http://localhost:3001 (or another port). It connects to the backend at http://localhost:3000.

## How It Works

The backend uses MongoDB to store messages indexed by contact WhatsApp ID (wa_id). Messages include metadata such as sender, timestamp, message type, and file URLs. It exposes REST APIs to fetch users, messages, send messages, delete messages or entire chats, and a webhook endpoint for receiving WhatsApp webhook events.

The backend sets up a WebSocket server (Socket.io) to broadcast real-time events like new messages, message status updates (sent, delivered, read), deleted messages, and typing notifications.

The frontend displays a sidebar with all chat users and their last message previews, unread counts, and search capability. Clicking a user loads their full message chat sorted by timestamp. The chat panel shows messages with bubbles styled differently if sent or received, supporting text, image, audio, and file types.

Users can send messages by typing text or attaching files (images, audio, documents). Sending triggers an API call, and the message shows instantly with temporary ID until confirmed by the server.

Real-time updates from the socket keep the interface synced for message status, new incoming messages, deletions, and typing indicators.

Dark mode toggle lets users switch theme for better readability in low-light environments.

## Project Structure

Backend
server.js — Main backend server and API routes

/payloads/ — Sample JSON payloads for webhook testing

.env — Environment variables (excluded via .gitignore)

Frontend
src/ — React components and main entry App.js

public/ — Static assets (favicon, manifest, HTML template)

.env — Frontend environment config (optional)

## Usage

Start backend (npm start) and frontend (npm start).

Open the frontend in a browser.

Use the sidebar to select or create chats.

Send messages via the input area or attach files.

Watch messages update in real time when sent or received.

Delete messages or chats as needed.

Toggle dark/light modes with the icon in the header.

## Available Scripts

Backend
npm start — Start Express & Socket.io server

Frontend
npm start — Run React development server

npm run build — Build production-ready frontend

## Contributing

Contributions are welcome! Feel free to open issues or pull requests to enhance features, improve documentation, or fix bugs.

## License

This project is open source and free to use.

## Author

Created by Devingle (Amit Ghanata)

## Live Project Link

```
https://whats-app-like-web-clone.vercel.app/
```
