require("dotenv").config();
const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    store: new pgSession({
        pool,
        tableName: "user_sessions",
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function page(title, content) {
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} — VENOM X</title>

<style>
*{box-sizing:border-box}

body{
    margin:0;
    min-height:100vh;
    background:#050505;
    color:#fff;
    font-family:Arial,sans-serif;
    display:flex;
    align-items:center;
    justify-content:center;
}

.card{
    width:min(92%,460px);
    background:#0d0d0d;
    border:1px solid #242424;
    border-radius:20px;
    padding:30px;
    box-shadow:0 20px 70px rgba(0,0,0,.55);
}

h1{
    text-align:center;
    letter-spacing:4px;
    margin:0 0 8px;
}

h2{
    margin-top:0;
}

.subtitle{
    text-align:center;
    color:#888;
    margin-bottom:25px;
}

input{
    width:100%;
    padding:14px;
    margin:7px 0;
    border:1px solid #292929;
    border-radius:10px;
    background:#151515;
    color:#fff;
    outline:none;
}

input:focus{
    border-color:#555;
}

button{
    width:100%;
    padding:14px;
    margin-top:12px;
    border:0;
    border-radius:10px;
    background:#fff;
    color:#000;
    font-weight:bold;
    cursor:pointer;
}

button:hover{
    opacity:.9;
}

a{
    color:#aaa;
    text-decoration:none;
}

.links{
    text-align:center;
    margin-top:18px;
    line-height:1.8;
}

.error{
    background:#241010;
    border:1px solid #542020;
    padding:12px;
    border-radius:10px;
    margin-bottom:15px;
}

.success{
    background:#102414;
    border:1px solid #214d29;
    padding:12px;
    border-radius:10px;
    margin-bottom:15px;
}

.info{
    background:#111820;
    border:1px solid #263646;
    padding:12px;
    border-radius:10px;
    margin-bottom:15px;
}

.stat{
    background:#111;
    border:1px solid #222;
    border-radius:12px;
    padding:15px;
    margin:10px 0;
}

table{
    width:100%;
    border-collapse:collapse;
    font-size:13px;
}

th,td{
    padding:9px;
    border-bottom:1px solid #252525;
    text-align:left;
}

.badge{
    display:inline-block;
    padding:5px 9px;
    border-radius:20px;
    background:#191919;
    color:#bbb;
    font-size:12px;
}
</style>
</head>

<body>
<div class="card">
<h1>VENOM X</h1>
<div class="subtitle">${escapeHtml(title)}</div>
${content}
</div>
</body>
</html>`;
}

async function query(text, params = []) {
    return pool.query(text, params);
}

async function initDatabase() {
    await query(`
        CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS reset_tokens (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at TIMESTAMPTZ NOT NULL,
            used BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS license_keys (
            id BIGSERIAL PRIMARY KEY,
            key TEXT NOT NULL UNIQUE,
            duration TEXT NOT NULL,
            used_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
            expires_at TIMESTAMPTZ,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS deployments (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            phone TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    console.log("PostgreSQL database initialized.");
}

function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    next();
}

function requireAdmin(req, res, next) {
    if (
        !req.session.user ||
        req.session.user.role !== "admin"
    ) {
        return res.status(403).send(
            page(
                "Access denied",
                `
                <div class="error">
                    You do not have administrator access.
                </div>

                <div class="links">
                    <a href="/dashboard">Back to dashboard</a>
                </div>
                `
            )
        );
    }

    next();
}

/* =========================================================
   HEALTH
========================================================= */

app.get("/health", async (req, res) => {
    try {
        await query("SELECT 1");

        res.json({
            ok: true,
            service: "VENOM X PANEL",
            database: "connected"
        });
    } catch (err) {
        res.status(500).json({
            ok: false,
            service: "VENOM X PANEL",
            database: "disconnected"
        });
    }
});

/* =========================================================
   HOME
========================================================= */

app.get("/", (req, res) => {
    if (req.session.user) {
        return res.redirect("/dashboard");
    }

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VENOM X — Deployment Portal</title>

<style>
*{
    margin:0;
    padding:0;
    box-sizing:border-box;
}

html,body{
    width:100%;
    height:100%;
}

body{
    overflow:hidden;
    font-family:Arial,Helvetica,sans-serif;
    color:#fff;
    background:#02040a;
}

.scene{
    position:relative;
    width:100%;
    height:100vh;
    overflow:hidden;
    background:
        radial-gradient(circle at 50% 45%,rgba(0,255,225,.14),transparent 18%),
        radial-gradient(circle at 15% 25%,rgba(0,140,255,.12),transparent 24%),
        radial-gradient(circle at 85% 70%,rgba(130,0,255,.12),transparent 25%),
        radial-gradient(circle at 50% 100%,rgba(0,255,225,.08),transparent 35%),
        #02040a;
}

/* BACKGROUND GLOW */

.glow{
    position:absolute;
    left:50%;
    top:42%;
    width:520px;
    height:520px;
    transform:translate(-50%,-50%);
    border-radius:50%;
    background:rgba(0,255,225,.07);
    filter:blur(75px);
    animation:pulseGlow 5s ease-in-out infinite;
}

.glow2{
    position:absolute;
    left:15%;
    top:20%;
    width:260px;
    height:260px;
    border-radius:50%;
    background:rgba(0,120,255,.08);
    filter:blur(65px);
    animation:floatGlow 8s ease-in-out infinite;
}

.glow3{
    position:absolute;
    right:10%;
    bottom:15%;
    width:300px;
    height:300px;
    border-radius:50%;
    background:rgba(170,0,255,.07);
    filter:blur(75px);
    animation:floatGlow 10s ease-in-out infinite reverse;
}

/* NEON LINES */

.beam{
    position:absolute;
    top:-20%;
    left:50%;
    width:2px;
    height:150%;
    background:#00ffe1;
    opacity:.22;
    box-shadow:
        0 0 8px #00ffe1,
        0 0 25px #00ffe1,
        0 0 70px #00ffe1;
    animation:beamPulse 3s ease-in-out infinite;
}

.beam.left{
    left:20%;
    opacity:.07;
    transform:rotate(18deg);
}

.beam.right{
    left:80%;
    opacity:.07;
    transform:rotate(-18deg);
}

/* GRID */

.grid{
    position:absolute;
    left:-20%;
    bottom:-32%;
    width:140%;
    height:65%;
    transform:perspective(650px) rotateX(64deg);
    background-image:
        linear-gradient(rgba(0,255,225,.28) 1px,transparent 1px),
        linear-gradient(90deg,rgba(0,255,225,.28) 1px,transparent 1px);
    background-size:55px 55px;
    box-shadow:
        0 -20px 80px rgba(0,255,225,.15);
    animation:gridPulse 4s ease-in-out infinite;
}

.gridGlow{
    position:absolute;
    left:50%;
    bottom:8%;
    width:500px;
    height:45px;
    transform:translateX(-50%);
    border-radius:50%;
    background:rgba(0,255,225,.25);
    filter:blur(25px);
}

/* PARTICLES */

.particle{
    position:absolute;
    width:4px;
    height:4px;
    border-radius:50%;
    background:#00ffe1;
    box-shadow:
        0 0 6px #00ffe1,
        0 0 15px #00ffe1;
    animation:particleFloat 5s linear infinite;
}

.p1{left:12%;top:70%;animation-delay:0s}
.p2{left:22%;top:35%;animation-delay:1s}
.p3{left:76%;top:30%;animation-delay:2s}
.p4{left:88%;top:62%;animation-delay:3s}
.p5{left:58%;top:18%;animation-delay:4s}
.p6{left:38%;top:78%;animation-delay:2.5s}

/* TOP BRAND */

.brand{
    position:absolute;
    z-index:10;
    left:50%;
    top:8%;
    transform:translateX(-50%);
    text-align:center;
}

.brand h1{
    font-size:clamp(30px,7vw,58px);
    font-weight:1000;
    letter-spacing:10px;
    color:#fff;
    text-shadow:
        0 0 5px #fff,
        0 0 12px #00ffe1,
        0 0 25px #00ffe1,
        0 0 55px rgba(0,255,225,.8);
    animation:textPulse 3s ease-in-out infinite;
}

.brand p{
    margin-top:7px;
    font-size:9px;
    letter-spacing:5px;
    color:#66fff0;
    text-shadow:
        0 0 8px #00ffe1,
        0 0 20px rgba(0,255,225,.7);
}

/* LOGIN CARD */

.loginPanel{
    position:absolute;
    z-index:20;
    left:50%;
    top:52%;
    transform:translate(-50%,-50%);
    width:min(90%,430px);
    padding:34px;
    border:1px solid #00ffe1;
    border-radius:24px;
    background:
        linear-gradient(
            145deg,
            rgba(4,22,25,.96),
            rgba(2,6,15,.98)
        );
    box-shadow:
        0 0 8px #00ffe1,
        0 0 25px rgba(0,255,225,.7),
        0 0 55px rgba(0,255,225,.35),
        0 0 100px rgba(0,120,255,.2),
        inset 0 0 25px rgba(0,255,225,.08);
    animation:
        panelIn 1.2s ease-out,
        panelGlow 4s ease-in-out 1.2s infinite;
}

.loginPanel:before{
    content:"";
    position:absolute;
    inset:-2px;
    border-radius:25px;
    border:1px solid rgba(0,255,225,.25);
    box-shadow:
        0 0 20px rgba(0,255,225,.3),
        inset 0 0 20px rgba(0,255,225,.08);
    pointer-events:none;
}

.loginPanel:after{
    content:"";
    position:absolute;
    left:10%;
    right:10%;
    top:-1px;
    height:2px;
    background:#00ffe1;
    box-shadow:
        0 0 8px #00ffe1,
        0 0 20px #00ffe1;
    animation:scanLine 3s linear infinite;
}

.panelTitle{
    text-align:center;
    font-size:25px;
    font-weight:1000;
    letter-spacing:6px;
    color:#fff;
    text-shadow:
        0 0 7px #fff,
        0 0 15px #00ffe1,
        0 0 35px #00ffe1;
}

.panelSubtitle{
    margin:9px 0 25px;
    text-align:center;
    font-size:9px;
    letter-spacing:3px;
    color:#5db8af;
}

/* INPUTS */

.inputGroup{
    margin-bottom:17px;
}

.inputGroup label{
    display:block;
    margin-bottom:7px;
    font-size:9px;
    letter-spacing:2px;
    color:#68dcd2;
    text-shadow:0 0 8px rgba(0,255,225,.5);
}

.inputGroup input{
    width:100%;
    padding:14px 15px;
    border:1px solid rgba(0,255,225,.35);
    border-radius:11px;
    outline:none;
    color:#fff;
    background:
        linear-gradient(
            90deg,
            rgba(0,255,225,.035),
            rgba(0,80,100,.08)
        );
    box-shadow:
        inset 0 0 12px rgba(0,255,225,.03),
        0 0 5px rgba(0,255,225,.08);
    transition:.3s;
}

.inputGroup input::placeholder{
    color:#41615e;
}

.inputGroup input:focus{
    border-color:#00ffe1;
    box-shadow:
        0 0 7px #00ffe1,
        0 0 20px rgba(0,255,225,.35),
        inset 0 0 15px rgba(0,255,225,.06);
}

/* LOGIN BUTTON */

.loginBtn{
    width:100%;
    margin-top:6px;
    padding:15px;
    border:1px solid #00ffe1;
    border-radius:12px;
    cursor:pointer;
    color:#00110e;
    background:#00ffe1;
    font-size:12px;
    font-weight:1000;
    letter-spacing:3px;
    box-shadow:
        0 0 8px #00ffe1,
        0 0 22px rgba(0,255,225,.65),
        0 0 45px rgba(0,255,225,.25);
    transition:.25s;
}

.loginBtn:hover{
    transform:translateY(-2px);
    background:#8ffff5;
    box-shadow:
        0 0 12px #fff,
        0 0 25px #00ffe1,
        0 0 55px #00ffe1;
}

.loginBtn:active{
    transform:translateY(0) scale(.99);
}

/* LINKS */

.links{
    display:flex;
    justify-content:space-between;
    gap:10px;
    margin-top:18px;
}

.links a{
    color:#5cefe2;
    text-decoration:none;
    font-size:9px;
    letter-spacing:1px;
    text-shadow:0 0 7px rgba(0,255,225,.5);
}

.links a:hover{
    color:#fff;
    text-shadow:
        0 0 8px #fff,
        0 0 18px #00ffe1;
}

/* FOOTER */

.footer{
    margin-top:24px;
    padding-top:14px;
    border-top:1px solid rgba(0,255,225,.12);
    text-align:center;
    color:#315b58;
    font-size:8px;
    letter-spacing:3px;
}

/* STATUS */

.status{
    position:absolute;
    z-index:10;
    left:50%;
    bottom:4%;
    transform:translateX(-50%);
    display:flex;
    align-items:center;
    gap:8px;
    color:#54cfc3;
    font-size:8px;
    letter-spacing:3px;
    text-shadow:0 0 8px rgba(0,255,225,.7);
}

.statusDot{
    width:7px;
    height:7px;
    border-radius:50%;
    background:#00ffe1;
    box-shadow:
        0 0 6px #00ffe1,
        0 0 18px #00ffe1;
    animation:dotPulse 1.5s infinite;
}

/* ANIMATIONS */

@keyframes pulseGlow{
    0%,100%{opacity:.65;transform:translate(-50%,-50%) scale(.92)}
    50%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}
}

@keyframes floatGlow{
    0%,100%{transform:translateY(0)}
    50%{transform:translateY(-35px)}
}

@keyframes beamPulse{
    0%,100%{opacity:.12}
    50%{opacity:.3}
}

@keyframes gridPulse{
    0%,100%{opacity:.65}
    50%{opacity:1}
}

@keyframes textPulse{
    0%,100%{filter:brightness(.9)}
    50%{filter:brightness(1.25)}
}

@keyframes panelIn{
    0%{
        opacity:0;
        transform:translate(-50%,-45%) scale(.88);
    }
    70%{
        opacity:1;
        transform:translate(-50%,-50%) scale(1.02);
    }
    100%{
        opacity:1;
        transform:translate(-50%,-50%) scale(1);
    }
}

@keyframes panelGlow{
    0%,100%{
        box-shadow:
            0 0 8px #00ffe1,
            0 0 25px rgba(0,255,225,.7),
            0 0 55px rgba(0,255,225,.35),
            0 0 100px rgba(0,120,255,.2),
            inset 0 0 25px rgba(0,255,225,.08);
    }
    50%{
        box-shadow:
            0 0 12px #00ffe1,
            0 0 38px rgba(0,255,225,.85),
            0 0 75px rgba(0,255,225,.45),
            0 0 120px rgba(120,0,255,.18),
            inset 0 0 35px rgba(0,255,225,.12);
    }
}

@keyframes scanLine{
    0%{transform:translateX(-120%);opacity:0}
    20%{opacity:1}
    80%{opacity:1}
    100%{transform:translateX(120%);opacity:0}
}

@keyframes particleFloat{
    0%{
        transform:translateY(30px);
        opacity:0;
    }
    20%{opacity:1}
    80%{opacity:1}
    100%{
        transform:translateY(-120px);
        opacity:0;
    }
}

@keyframes dotPulse{
    0%,100%{transform:scale(.8);opacity:.6}
    50%{transform:scale(1.4);opacity:1}
}

@media(max-width:600px){
    .brand{
        top:5%;
    }

    .brand h1{
        font-size:34px;
        letter-spacing:6px;
    }

    .loginPanel{
        width:calc(100% - 32px);
        padding:27px 22px;
        top:51%;
    }

    .grid{
        bottom:-28%;
    }
}

@media(prefers-reduced-motion:reduce){
    *,
    *::before,
    *::after{
        animation-duration:.01ms!important;
        animation-iteration-count:1!important;
    }
}
</style>
</head>

<body>

<div class="scene">

<div class="glow"></div>
<div class="glow2"></div>
<div class="glow3"></div>

<div class="beam"></div>
<div class="beam left"></div>
<div class="beam right"></div>

<div class="grid"></div>
<div class="gridGlow"></div>

<div class="particle p1"></div>
<div class="particle p2"></div>
<div class="particle p3"></div>
<div class="particle p4"></div>
<div class="particle p5"></div>
<div class="particle p6"></div>

<div class="brand">
    <h1>VENOM X</h1>
    <p>WHATSAPP DEPLOYMENT PORTAL</p>
</div>

<div class="loginPanel">

    <div class="panelTitle">LOGIN</div>

    <div class="panelSubtitle">
        SECURE ACCESS TO VENOM X
    </div>

    <form method="POST" action="/login">

        <div class="inputGroup">
            <label>EMAIL</label>
            <input
                type="email"
                name="email"
                placeholder="Enter your email"
                required
                autocomplete="email"
            >
        </div>

        <div class="inputGroup">
            <label>PASSWORD</label>
            <input
                type="password"
                name="password"
                placeholder="Enter your password"
                required
                autocomplete="current-password"
            >
        </div>

        <button type="submit" class="loginBtn">
            LOGIN TO VENOM X
        </button>

    </form>

    <div class="links">
        <a href="/register">CREATE ACCOUNT</a>
        <a href="/forgot-password">FORGOT PASSWORD?</a>
    </div>

    <div class="footer">
        SECURE • PRIVATE • VENOM X
    </div>

</div>

<div class="status">
    <span class="statusDot"></span>
    VENOM X SYSTEM ONLINE
</div>

</div>

</body>
</html>`);
});

/* =========================================================
   REGISTER
========================================================= */

app.get("/register", (req, res) => {
    res.send(page("Create Account", `
        <form method="POST" action="/register">

            <input
                name="username"
                placeholder="Username"
                required
                minlength="3"
                maxlength="30"
                autocomplete="username"
            >

            <input
                name="email"
                type="email"
                placeholder="Email address"
                required
                maxlength="120"
                autocomplete="email"
            >

            <input
                name="password"
                type="password"
                placeholder="Password"
                required
                minlength="8"
                autocomplete="new-password"
            >

            <input
                name="confirmPassword"
                type="password"
                placeholder="Confirm password"
                required
                minlength="8"
                autocomplete="new-password"
            >

            <button type="submit">REGISTER</button>
        </form>

        <div class="links">
            <a href="/login">Already have an account? Login</a>
        </div>
    `));
});

app.post("/register", async (req, res) => {
    try {
        const username =
            String(req.body.username || "").trim();

        const email =
            String(req.body.email || "")
                .trim()
                .toLowerCase();

        const password =
            String(req.body.password || "");

        const confirmPassword =
            String(req.body.confirmPassword || "");

        if (username.length < 3) {
            return res.send(page("Registration failed", `
                <div class="error">
                    Username must contain at least 3 characters.
                </div>
                <a href="/register">Go back</a>
            `));
        }

        if (password.length < 8) {
            return res.send(page("Registration failed", `
                <div class="error">
                    Password must contain at least 8 characters.
                </div>
                <a href="/register">Go back</a>
            `));
        }

        if (password !== confirmPassword) {
            return res.send(page("Registration failed", `
                <div class="error">
                    Passwords do not match.
                </div>
                <a href="/register">Go back</a>
            `));
        }

        const existing = await query(`
            SELECT id
            FROM users
            WHERE username = $1 OR email = $2
            LIMIT 1
        `, [username, email]);

        if (existing.rows.length) {
            return res.send(page("Registration failed", `
                <div class="error">
                    Username or email is already registered.
                </div>
                <a href="/register">Go back</a>
            `));
        }

        const passwordHash =
            await bcrypt.hash(password, 12);

        const result = await query(`
            INSERT INTO users
                (username,email,password_hash,role)
            VALUES
                ($1,$2,$3,'user')
            RETURNING id,username,email,role
        `, [
            username,
            email,
            passwordHash
        ]);

        const user = result.rows[0];

        req.session.user = {
            id: String(user.id),
            username: user.username,
            email: user.email,
            role: user.role
        };

        res.redirect("/dashboard");

    } catch (err) {
        console.error("REGISTER ERROR:", err.message);

        res.status(500).send(
            page(
                "Registration error",
                `<div class="error">Could not create account.</div>`
            )
        );
    }
});

/* =========================================================
   LOGIN
========================================================= */

app.get("/login", (req, res) => {
    res.send(page("Login", `
        <form method="POST" action="/login">

            <input
                name="email"
                type="email"
                placeholder="Email address"
                required
                autocomplete="email"
            >

            <input
                name="password"
                type="password"
                placeholder="Password"
                required
                autocomplete="current-password"
            >

            <button type="submit">LOGIN</button>
        </form>

        <div class="links">
            <a href="/register">Create account</a><br>
            <a href="/forgot-password">Forgot password?</a>
        </div>
    `));
});

app.post("/login", async (req, res) => {
    try {
        const email =
            String(req.body.email || "")
                .trim()
                .toLowerCase();

        const password =
            String(req.body.password || "");

        const result = await query(`
            SELECT *
            FROM users
            WHERE email = $1
            LIMIT 1
        `, [email]);

        const user = result.rows[0];

        if (
            !user ||
            !(await bcrypt.compare(
                password,
                user.password_hash
            ))
        ) {
            return res.send(page("Login failed", `
                <div class="error">
                    Invalid email or password.
                </div>

                <div class="links">
                    <a href="/login">Try again</a><br>
                    <a href="/forgot-password">Forgot password?</a>
                </div>
            `));
        }

        req.session.user = {
            id: String(user.id),
            username: user.username,
            email: user.email,
            role: user.role
        };

        res.redirect("/dashboard");

    } catch (err) {
        console.error("LOGIN ERROR:", err.message);

        res.status(500).send(
            page(
                "Login error",
                `<div class="error">Login failed.</div>`
            )
        );
    }
});

/* =========================================================
   FORGOT PASSWORD
========================================================= */

app.get("/forgot-password", (req, res) => {
    res.send(page("Reset Password", `
        <p>
            Enter the email address connected to your account.
        </p>

        <form method="POST" action="/forgot-password">

            <input
                name="email"
                type="email"
                placeholder="Email address"
                required
                autocomplete="email"
            >

            <button type="submit">
                REQUEST RESET
            </button>
        </form>

        <div class="links">
            <a href="/login">Back to login</a>
        </div>
    `));
});

app.post("/forgot-password", async (req, res) => {
    try {
        const email =
            String(req.body.email || "")
                .trim()
                .toLowerCase();

        const result = await query(`
            SELECT id
            FROM users
            WHERE email = $1
            LIMIT 1
        `, [email]);

        const user = result.rows[0];

        if (user) {
            const rawToken =
                crypto.randomBytes(32).toString("hex");

            const tokenHash =
                crypto
                    .createHash("sha256")
                    .update(rawToken)
                    .digest("hex");

            await query(`
                INSERT INTO reset_tokens
                    (user_id,token_hash,expires_at)
                VALUES
                    ($1,$2,NOW() + INTERVAL '30 minutes')
            `, [
                user.id,
                tokenHash
            ]);

            /*
             * TEMPORARY:
             * Until SMTP/email is connected, the reset URL
             * is printed in the server log.
             *
             * We will replace this with real email delivery.
             */

            const resetUrl =
                "/reset-password?token=" + rawToken;

            console.log(
                "[PASSWORD RESET]",
                resetUrl
            );
        }

        /*
         * Never reveal whether the email exists.
         */

        res.send(page("Reset Requested", `
            <div class="success">
                If that email is registered, a password
                reset link has been created.
            </div>

            <div class="info">
                Email delivery will be connected to the
                production mail service before launch.
            </div>

            <div class="links">
                <a href="/login">Return to login</a>
            </div>
        `));

    } catch (err) {
        console.error(
            "FORGOT PASSWORD ERROR:",
            err.message
        );

        res.status(500).send(
            page(
                "Reset error",
                `<div class="error">Could not process request.</div>`
            )
        );
    }
});

/* =========================================================
   RESET PASSWORD
========================================================= */

app.get("/reset-password", async (req, res) => {
    const token =
        String(req.query.token || "");

    if (!token) {
        return res.status(400).send(
            page(
                "Invalid reset link",
                `<div class="error">Reset token missing.</div>`
            )
        );
    }

    const tokenHash =
        crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

    const result = await query(`
        SELECT id
        FROM reset_tokens
        WHERE token_hash = $1
          AND used = FALSE
          AND expires_at > NOW()
        LIMIT 1
    `, [tokenHash]);

    if (!result.rows.length) {
        return res.status(400).send(
            page("Invalid reset link", `
                <div class="error">
                    This reset link is invalid or expired.
                </div>

                <a href="/forgot-password">
                    Request another reset
                </a>
            `)
        );
    }

    res.send(page("Choose New Password", `
        <form method="POST" action="/reset-password">

            <input
                type="hidden"
                name="token"
                value="${escapeHtml(token)}"
            >

            <input
                name="password"
                type="password"
                placeholder="New password"
                required
                minlength="8"
                autocomplete="new-password"
            >

            <input
                name="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                required
                minlength="8"
                autocomplete="new-password"
            >

            <button type="submit">
                CHANGE PASSWORD
            </button>
        </form>
    `));
});

app.post("/reset-password", async (req, res) => {
    try {
        const token =
            String(req.body.token || "");

        const password =
            String(req.body.password || "");

        const confirmPassword =
            String(req.body.confirmPassword || "");

        if (
            !token ||
            password.length < 8 ||
            password !== confirmPassword
        ) {
            return res.send(page("Reset failed", `
                <div class="error">
                    Invalid token or passwords do not match.
                </div>

                <a href="/forgot-password">
                    Request another reset
                </a>
            `));
        }

        const tokenHash =
            crypto
                .createHash("sha256")
                .update(token)
                .digest("hex");

        const tokenResult = await query(`
            SELECT id,user_id
            FROM reset_tokens
            WHERE token_hash = $1
              AND used = FALSE
              AND expires_at > NOW()
            LIMIT 1
        `, [tokenHash]);

        const reset = tokenResult.rows[0];

        if (!reset) {
            return res.send(page("Reset failed", `
                <div class="error">
                    This reset link is invalid or expired.
                </div>

                <a href="/forgot-password">
                    Request another reset
                </a>
            `));
        }

        const passwordHash =
            await bcrypt.hash(password, 12);

        const client =
            await pool.connect();

        try {
            await client.query("BEGIN");

            await client.query(`
                UPDATE users
                SET password_hash = $1
                WHERE id = $2
            `, [
                passwordHash,
                reset.user_id
            ]);

            await client.query(`
                UPDATE reset_tokens
                SET used = TRUE
                WHERE id = $1
            `, [reset.id]);

            await client.query("COMMIT");

        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }

        res.send(page("Password Changed", `
            <div class="success">
                Your password has been changed successfully.
            </div>

            <div class="links">
                <a href="/login">LOGIN</a>
            </div>
        `));

    } catch (err) {
        console.error(
            "RESET PASSWORD ERROR:",
            err.message
        );

        res.status(500).send(
            page(
                "Reset error",
                `<div class="error">Could not change password.</div>`
            )
        );
    }
});

/* =========================================================
   DASHBOARD
========================================================= */

app.get("/dashboard", requireLogin, async (req, res) => {
    const user = req.session.user;

    const result = await query(`
        SELECT id,phone,status,created_at
        FROM deployments
        WHERE user_id = $1
        ORDER BY id DESC
    `, [user.id]);

    const deployments = result.rows;

    const deploymentRows =
        deployments.length
            ? deployments.map(d => `
                <tr>
                    <td>${escapeHtml(d.phone || "Not paired")}</td>
                    <td>${escapeHtml(d.status)}</td>
                    <td>${new Date(d.created_at).toLocaleString()}</td>
                </tr>
            `).join("")
            : `
                <tr>
                    <td colspan="3">
                        No deployments yet.
                    </td>
                </tr>
            `;

    res.send(page("Dashboard", `
        <h2>WELCOME, ${escapeHtml(user.username)}</h2>

        <div class="stat">
            <strong>Email</strong><br>
            ${escapeHtml(user.email)}
        </div>

        <div class="stat">
            <strong>Account</strong><br>
            <span class="badge">
                ${escapeHtml(user.role.toUpperCase())}
            </span>
        </div>

        <form action="/deploy" method="get">
            <button>DEPLOY VENOM X</button>
        </form>

        <h3>Your deployments</h3>

        <table>
            <tr>
                <th>Number</th>
                <th>Status</th>
                <th>Date</th>
            </tr>

            ${deploymentRows}
        </table>

        ${
            user.role === "admin"
                ? `
                <form action="/admin" method="get">
                    <button>ADMIN PANEL</button>
                </form>
                `
                : ""
        }

        <form action="/logout" method="post">
            <button>LOGOUT</button>
        </form>
    `));
});

/* =========================================================
   DEPLOY PAGE
========================================================= */

app.get("/deploy", requireLogin, (req, res) => {
    res.send(page("Deploy VENOM X", `
        <h2>DEPLOY VENOM X</h2>

        <div class="info">
            Your account is ready.
            Deployment configuration will be connected
            to the WhatsApp session manager next.
        </div>

        <form method="POST" action="/deploy">

            <input
                name="phone"
                placeholder="WhatsApp number e.g. 2349163743900"
                required
            >

            <button type="submit">
                START DEPLOYMENT
            </button>
        </form>

        <div class="links">
            <a href="/dashboard">Back to dashboard</a>
        </div>
    `));
});

app.post("/deploy", requireLogin, async (req, res) => {
    const phone =
        String(req.body.phone || "")
            .replace(/\D/g, "");

    if (
        phone.length < 8 ||
        phone.length > 15
    ) {
        return res.send(page("Deployment failed", `
            <div class="error">
                Invalid WhatsApp number.
            </div>

            <a href="/deploy">Try again</a>
        `));
    }

    await query(`
        INSERT INTO deployments
            (user_id,phone,status)
        VALUES
            ($1,$2,'pending')
    `, [
        req.session.user.id,
        phone
    ]);

    res.send(page("Deployment Created", `
        <div class="success">
            Deployment request created successfully.
        </div>

        <div class="info">
            WhatsApp number:
            <strong>+${escapeHtml(phone)}</strong>
            <br><br>
            Status: PENDING
        </div>

        <div class="links">
            <a href="/dashboard">Return to dashboard</a>
        </div>
    `));
});

/* =========================================================
   LOGOUT
========================================================= */

app.post("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

/* =========================================================
   ADMIN
========================================================= */

app.get("/admin", requireAdmin, async (req, res) => {
    const usersResult = await query(`
        SELECT id,username,email,role,created_at
        FROM users
        ORDER BY id DESC
    `);

    const keysResult = await query(`
        SELECT id,key,duration,active,expires_at,created_at
        FROM license_keys
        ORDER BY id DESC
    `);

    const deploymentsResult = await query(`
        SELECT
            d.id,
            d.phone,
            d.status,
            d.created_at,
            u.username,
            u.email
        FROM deployments d
        JOIN users u ON u.id = d.user_id
        ORDER BY d.id DESC
    `);

    const users = usersResult.rows;
    const keys = keysResult.rows;
    const deployments = deploymentsResult.rows;

    const userRows =
        users.map(user => `
            <tr>
                <td>${escapeHtml(user.username)}</td>
                <td>${escapeHtml(user.email)}</td>
                <td>${escapeHtml(user.role)}</td>
            </tr>
        `).join("");

    const keyRows =
        keys.length
            ? keys.map(key => `
                <tr>
                    <td>${escapeHtml(key.key)}</td>
                    <td>${escapeHtml(key.duration)}</td>
                    <td>${key.active ? "ACTIVE" : "INACTIVE"}</td>
                </tr>
            `).join("")
            : `
                <tr>
                    <td colspan="3">
                        No license keys yet.
                    </td>
                </tr>
            `;

    const deploymentRows =
        deployments.length
            ? deployments.map(d => `
                <tr>
                    <td>${escapeHtml(d.username)}</td>
                    <td>${escapeHtml(d.phone || "")}</td>
                    <td>${escapeHtml(d.status)}</td>
                </tr>
            `).join("")
            : `
                <tr>
                    <td colspan="3">
                        No deployments.
                    </td>
                </tr>
            `;

    res.send(page("Admin Panel", `
        <h2>VENOM X ADMIN</h2>

        <div class="stat">
            Users: <strong>${users.length}</strong>
        </div>

        <h3>Generate License Key</h3>

        <form method="POST" action="/admin/generate-key">

            <select
                name="duration"
                style="
                    width:100%;
                    padding:14px;
                    margin:7px 0;
                    border-radius:10px;
                    background:#151515;
                    color:white;
                    border:1px solid #292929;
                "
            >
                <option value="1week">1 Week</option>
                <option value="2weeks">2 Weeks</option>
                <option value="1month">1 Month</option>
                <option value="unlimited">Unlimited</option>
            </select>

            <button type="submit">
                GENERATE KEY
            </button>
        </form>

        <h3>Users</h3>

        <table>
            <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
            </tr>
            ${userRows}
        </table>

        <h3>License Keys</h3>

        <table>
            <tr>
                <th>Key</th>
                <th>Duration</th>
                <th>Status</th>
            </tr>
            ${keyRows}
        </table>

        <h3>Deployments</h3>

        <table>
            <tr>
                <th>User</th>
                <th>Number</th>
                <th>Status</th>
            </tr>
            ${deploymentRows}
        </table>

        <div class="links">
            <a href="/dashboard">Dashboard</a>
        </div>
    `));
});

/* =========================================================
   ADMIN KEY GENERATOR
========================================================= */

app.post("/admin/generate-key", requireAdmin, async (req, res) => {
    const duration =
        String(req.body.duration || "");

    const allowed = [
        "1week",
        "2weeks",
        "1month",
        "unlimited"
    ];

    if (!allowed.includes(duration)) {
        return res.status(400).send(
            page(
                "Invalid duration",
                `<div class="error">Invalid license duration.</div>`
            )
        );
    }

    const randomA =
        crypto.randomBytes(4)
            .toString("hex")
            .toUpperCase();

    const randomB =
        crypto.randomBytes(4)
            .toString("hex")
            .toUpperCase();

    const key =
        `VX-${randomA}-${randomB}`;

    let expiresAt = null;

    if (duration === "1week") {
        expiresAt =
            new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000
            );
    }

    if (duration === "2weeks") {
        expiresAt =
            new Date(
                Date.now() + 14 * 24 * 60 * 60 * 1000
            );
    }

    if (duration === "1month") {
        expiresAt =
            new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000
            );
    }

    await query(`
        INSERT INTO license_keys
            (key,duration,expires_at)
        VALUES
            ($1,$2,$3)
    `, [
        key,
        duration,
        expiresAt
    ]);

    res.send(page("License Generated", `
        <div class="success">
            License generated successfully.
        </div>

        <div class="stat">
            <strong>KEY</strong><br><br>
            ${escapeHtml(key)}
        </div>

        <div class="stat">
            <strong>DURATION</strong><br>
            ${escapeHtml(duration)}
        </div>

        <div class="links">
            <a href="/admin">Back to admin</a>
        </div>
    `));
});

/* =========================================================
   START
========================================================= */

async function start() {
    try {
        await initDatabase();

        const adminEmail =
            String(process.env.ADMIN_EMAIL || "")
                .trim()
                .toLowerCase();

        if (adminEmail) {
            await query(`
                UPDATE users
                SET role = 'admin'
                WHERE email = $1
            `, [adminEmail]);

            console.log(
                "Admin account checked:",
                adminEmail
            );
        }

        app.listen(PORT, "0.0.0.0", () => {
            console.log(
                "VENOM X PANEL running on port " + PORT
            );
        });

    } catch (err) {
        console.error(
            "VENOM X PANEL STARTUP ERROR:",
            err.message
        );

        process.exit(1);
    }
}

process.on("SIGINT", async () => {
    await pool.end();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    await pool.end();
    process.exit(0);
});

start();
