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
    const user = await User.findOne({username, socialOnly: false});
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
        // ????????? ?????????
        const userData = await (await fetch(`${apiUrl}/user`,
                {method: "GET", headers: {Authorization: `token ${access_token}`}})
        ).json();
        // ????????? ??????
        const emailData = await (await fetch(`${apiUrl}/user/emails`,
                {method: "GET", headers: {Authorization: `token ${access_token}`}})
        ).json();
        const emailObj = emailData.find(email => email.primary===true && email.verified===true);
        if (!emailObj) {
            return res.redirect("/login")
        }
        let user = await User.findOne({email: emailObj.email});
        if (!user) {
            user = await User.create({
                name: userData.name,
                avatarUrl: userData.avatar_url,
                username: userData.login,
                email: emailObj.email,
                password: "",
                socialOnly: true,
                location: userData.location
            });
        }
        req.session.loggedIn = true;
        req.session.user = user;
        return res.redirect("/");
    } else {
        return res.redirect("/login")
    }
}

export const logout = (req, res) => {
    req.session.destroy();
    req.flash("info", "Bye Bye");
    return res.redirect("/")
};

export const getEdit = (req, res) => {
    return res.render("edit-profile", {pageTitle: "Edit Profile"})
};
export const postEdit = async (req, res) => {
    const {
        session: {
            user: { _id, avatarUrl }
        },
        body: {
            name, email, username, location
        },
        file
    } = req;

    const exists = await User.exists({
        $and: [
            {_id: { $ne: _id }},
            {$or: [{email}, {username}]}
        ]
    });
    if (exists) {
        return res.status(400).render(
            "edit-profile", {pageTitle: "Edit Profile", errorMessage: "This username/email is already taken."}
        )
    }

    req.session.user = await User.findByIdAndUpdate(_id, {
        name, email, username, location,
        avatarUrl: file ? file.path : avatarUrl
    }, {new: true});
    return res.redirect("/users/edit")
};

export const getChangePassword = (req, res) => {
    if (req.session.user.socialOnly === true) {
        req.flash("error", "Can't change password.");
        return res.redirect("/")
    }
    return res.render("users/change-password", {pageTitle: "Change Password"})
}

export const postChangePassword = async (req, res) => {
    const {
        body: { oldPassword, newPassword, newPasswordConfirmation },
        session: {
            user: { _id, password }
        }
    } = req;
    const ok = await bcrypt.compare(oldPassword, password);
    if (!ok) {
        return res.status(400).render("users/change-password",
            { pageTitle: "Change Password", errorMessage: "The current password is incorrect."}
        )
    }
    if (newPassword !== newPasswordConfirmation) {
        return res.status(400).render("users/change-password",
            { pageTitle: "Change Password", errorMessage: "The new password does not match the confirmation."}
        )
    }
    const user = await User.findById(_id);
    user.password = newPassword;
    await user.save();
    req.session.destroy();
    req.flash("info", "Password Updated");
    return res.redirect("/login");
}

export const see = async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(id).populate({
        path: "videos",
        populate: {
            path: "owner",
            model: "User"
        }
    });
    if (!user) {
        return res.status(400).render("404", { pageTitle: "User not found." });
    }
    return res.render("users/profile", { pageTitle: user.name, user })
};


