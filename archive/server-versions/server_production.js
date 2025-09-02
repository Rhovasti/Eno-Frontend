// Production server with all features
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

// Note: Anthropic SDK will be added after deployment
let Anthropic;
try {
    Anthropic = require('@anthropic-ai/sdk');
} catch (e) {
    console.log('Anthropic SDK not installed - AI features disabled');
}

const app = express();
const port = process.env.PORT || 3000;

// Production configuration
const JWT_SECRET = process.env.JWT_SECRET || 'eno-game-platform-secret-key-change-in-production';
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_ENABLED = !!AI_API_KEY && !!Anthropic;

if (AI_ENABLED) {
    console.log('AI features enabled');
} else {
    console.log('AI features disabled - set AI_API_KEY in environment');
}

// Copy the rest of server_sqlite_ai.js content here...
// (This would be the full server code)
