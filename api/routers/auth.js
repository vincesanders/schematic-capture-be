const router = require("express").Router();
const jwt = require("jsonwebtoken");
const axios = require("axios");

const reqToDb = require("../../utils/reqToDb");
const dbToRes = require("../../utils/dbToRes");
const { Users } = require("../../data/models");
const { generatePassword } = require('../../utils/generatePassword');
const { generateToken } = require('../../utils/generateToken');
const { jwtSecret } = require('../../utils/secrets');
const roleToRoleId = require('../middleware/users/roleToRoleId');
const registerUserWithOkta = require('../middleware/auth/registerUserWithOkta');
const sendEmailInvite = require('../middleware/auth/sendEmailInvite');
const changeOktaPassword = require('../middleware/auth/changeOktaPassword');
const changeOktaQuestion = require('../middleware/auth/changeOktaQuestion');

router.post('/login', (req, res) => {
    const loginInfo = {
        username: req.body.username,
        password: req.body.password,
        options: {
            multiOptionalFactorEnroll: true,
            warnBeforePasswordExpired: true
        }
    }
    //this url will change when we get our official okta account.
    axios
    .post(`https://dev-833124.okta.com/api/v1/authn`, loginInfo)
    .then(response => {
        //get user from database via email
        return user.findBy(response._embedded.user.profile.login);
    })
    .then(user => {
        res.status(200).json(user.data);
    })
    .catch(err => {
        res.status(500).json({error: err, message: 'Login with Okta failed.', step: 'api/auth/login'});
    });
});

//register user with email invite
router.post('/invite', roleToRoleId, registerUserWithOkta, sendEmailInvite, (req, res) => {
  //front-end sends technician email, role, full name as name
  const data = {
    id: req.id,
    role_id: req.body.roleId,
    email: req.body.email,
    first_name: first,
    last_name: last,
    question: "Who's a major player in the cowboy scene?"
  }
  //add user to database
  users.add(data).then(addedUser => {
    res.status(201).json({ user: addedUser });
  }).catch(err => {
    res.status(500).json({ 
      error: err, 
      message: 'Failed to add user to Schematic Capture database.', 
      step: 'api/auth/invite'
    });
  });
  //upon first sign in, user must change password and security question
  //front-end will send
      //1 new password
      //2 new security question and answer
      //3 token from url
  //make an api call to change password and security question
});

router.post('/firstlogin', changeOktaPassword, changeOktaQuestion, (req, res) => {
  //front-end will send
      //1 new password
      //2 new security question and answer
      //3 token from url
  const { newPassword, newQuestion } = req.body;
  const loginInfo = {
      username: req.token.email,
      password: newPassword,
      options: {
          multiOptionalFactorEnroll: true,
          warnBeforePasswordExpired: true
      }
  }
  //this url will be different.
  //log user in
  axios.post(`https://dev-833124.okta.com/api/v1/authn`, loginInfo)
  .then(response => {
    //update user in database
    users.update(req.token.id, { question: newQuestion }).then(() => {
      res.status(200).json(response.data);
    }).catch(err => {
      res.status(400).json({ 
        error: err, 
        message: 'Failed to change security question in Schematic Capture database.', 
        step: 'api/auth/changepassword'});
    })
  })
  .catch(err => {
    console.log(err);
    res.status(500).json({
      error: err, 
      message: 'Failed to log user in after changing password and security question.', 
      step: 'api/auth/changepassword'
    });
  });
});

//need some way of retrieving security question
router.get('/securityquestion/:id', (req, res) => {
  //get security question from db and send to front-end
  users.getQuestion(req.params.id)
  .then(question => {
      if (Object.keys(question).length === 0) { //No question found
          res.status(400).json({ errorMessage: 'No security question was found for the user.', step: 'api/auth/securityquestion/:id'});
      } else {
          res.status(200).json(question);
      }
  })
  .catch(err => {
      res.status(500).json({error: err, message: 'Couldn\'t get security question', step: 'api/auth/securityquestion/:id'});
  })
});

router.post('/forgotpassword', (req, res) => {
  //front end must send password (new password), answer to the security question and the useId (okta user id)
  const data = {
      password: { value: req.body.password },
      recovery_question: { answer: req.body.answer}
  }
  const header = {
      headers: {
          Authorization: `SSWS ${process.env.OKTA_REGISTER_TOKEN}`
      }
  }
  //this url will be different
  axios
  .post(
      `https://dev-833124.okta.com/api/v1/users/${req.body.userId}/credentials/forgot_password?sendEmail=false`,
      data, 
      header)
  .then(response => {
      res.status(200).json(response.data);
  })
  .catch(err => {
      res.status(500).json({error: err, message: 'Couldn\'t reset the password with Okta.', step: 'api/auth/forgotpassword'});
  })
});

//returns an array of security questions
router.get('/questions', (req, res) => {
  //this url will be different
  axios
  .get('https://dev-833124.okta.com/api/v1/users/00u4syc0frXBxcDtF4x6/factors/questions')
  .then(response => {
      res.status(200).json(response.data);
  })
  .catch(err => {
      res.status(500).json({error: err, message: 'Couldn\'t get recovery questions from Okta.', step: 'api/auth/questions'});
  })
});

module.exports = router;
