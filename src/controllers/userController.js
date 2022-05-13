import User from "../models/User"
import bcrypt from "bcrypt";
import fetch from "node-fetch";

export const getJoin = (req, res) => {
    return res.render("join", {pageTitle: "Join"})
};
export const postJoin = async (req, res) => {
    const pageTitle = "Join";
    const {name, email, username, password, password2, location} = req.body;
    if (password !== password2) {
        return res.status(400).render("join", {pageTitle, errorMessage: "Password confirmation does not match."})
    }
    const exists = await User.exists({$or: [{email}, {username}]});
    if (exists) {
        return res.status(400).render("join", {pageTitle, errorMessage: "This username/email is already taken."})
    }

    try {
        await User.create({
            name, email, username, password, location
        });
        return res.redirect("/login")
    } catch (error) {
        return res.status(400).render("join", {pageTitle, errorMessage: error._message})
    }

}
export const getLogin = (req, res) => {
    return res.render("login", {pageTitle: "Login"})
};
export const postLogin = async (req, res) => {
    const {username, password} = req.body;
    const pageTitle = "Login";
    const user = await User.findOne({username});
    if (!user) {
        return res.status(400).render("login", {
            pageTitle,
            errorMessage: "An account with this user name does not exists."
        })
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
        return res.status(400).render("login", {pageTitle, errorMessage: "Wrong Password"})
    }
    req.session.loggedIn = true;
    req.session.user = user;
    return res.redirect("/")
}

export const startGithubLogin = (req, res) => {
    const baseUrl = "https://github.com/login/oauth/authorize"
    const config = {
        client_id: process.env.GH_CLIENT,
        allow_signup: false,
        scope: "read:user user:email"
    }
    const params = new URLSearchParams(config).toString();
    const finalUrl = `${baseUrl}?${params}`;
    return res.redirect(finalUrl)
}

export const finishGithubLogin = async (req, res) => {
    const baseUrl = "https://github.com/login/oauth/access_token"
    const config = {
        client_id: process.env.GH_CLIENT,
        client_secret: process.env.GH_SECRET,
        code: req.query.code
    }
    const params = new URLSearchParams(config).toString();
    const finalUrl = `${baseUrl}?${params}`;
    const tokenRequest = await (
        await fetch(finalUrl, {method: "POST", headers: {Accept: "application/json"}})
    ).json();
    if ("access_token" in tokenRequest) {
        const {access_token} = tokenRequest;
        const apiUrl = "https://api.github.com"
        // 공개된 프로필
        const userData = await (await fetch(`${apiUrl}/user`,
                {method: "GET", headers: {Authorization: `token ${access_token}`}})
        ).json();
        console.log(userData);
        // 이메일 정보
        const emailData = await (await fetch(`${apiUrl}/user/emails`,
                {method: "GET", headers: {Authorization: `token ${access_token}`}})
        ).json();
        const email = emailData.find(email => email.primary===true && email.verified===true);
        if (!email) {
            return res.redirect("/login")
        }
        console.log(email);
    } else {
        return res.redirect("/login")
    }
    return res.end()
}

export const edit = (req, res) => res.send("Edit user");
export const remove = (req, res) => res.send("Remove user");
export const logout = (req, res) => res.send("Log out");
export const see = (req, res) => res.send("See User");


