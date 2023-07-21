const Email = require('../models/Email');
const Account = require('../models/Account');
const { validationResult } = require('express-validator');

const getAllEmails = async (request, response, next) => {
  try {
    // find the user (by id from token) and select its mailbox
    // populate all categories in the mailbox with email data
    const { mailbox } = await Account.findOne({ _id: request.user })
      .select('mailbox')
      .populate('mailbox.inbox mailbox.outbox mailbox.drafts mailbox.trash mailbox.favorite');
    console.log('Emails found', mailbox);

    const emails = await Email.find({});

    console.log("Emails: ", emails);

    response.status(200).json({ message: 'Emails found', mailbox, emails });
  } catch (error) {
    console.log(error);
    response.status(500);
  }
};

const sendEmail = async (request, response, next) => {
  try {
    // validate data types
    const validationErrors = validationResult(request);
    if (!validationErrors.isEmpty())
      return response.status(400).json({
        message: 'Invalid data, see response.data.errors for more information',
        errors: validationErrors.errors,
      });

    const id = request.params.id;
    const replyId = request.params.replyId;

    let mailSubject =
      id === replyId && id !== 'undefined' ? 'Re: ' + request.body.subject : request.body.subject;

    // construct outgoing email
    const newEmailOut = new Email({
      from: request.body.from,
      to: request.body.to,
      subject: mailSubject,
      message: request.body.message,
    });
    // save outgoing email
    const savedEmailOut = await newEmailOut.save();
    console.log('Email sent', savedEmailOut);

    response
      .status(201)
      .json({ message: 'Email sent, reply received', sent: savedEmailOut });

    // get user and update its email IDs (outbox)
    const foundSenderAccount = await Account.findOne({ _id: request.user });
    const foundReceiverAccount = await Account.findOne({ email: request.body.to });

    if (id == 'undefined' || replyId == 'undefined') {
      foundSenderAccount.mailbox.outbox.push(savedEmailOut._id);
      foundReceiverAccount.mailbox.inbox.push(savedEmailOut._id);
    } else if (id === replyId) {
      foundSenderAccount.mailbox.outbox.push(id);
      foundReceiverAccount.mailbox.inbox.push(id);

      let inbox = foundSenderAccount.mailbox.inbox;
      for (let i = 0; i < inbox.length; i++) {
        if (inbox[i].equals(id)) {
          inbox.splice(i, 1);
          break;
        }
      }

      let outbox = foundReceiverAccount.mailbox.outbox;
      for (let i = 0; i < outbox.length; i++) {
        if (outbox[i].equals(id)) {
          outbox.splice(i, 1);
          break;
        }
      }

      foundReceiverAccount.mailbox.inboxReply.push({ inboxId: id, replyId: [savedEmailOut._id] });
      foundReceiverAccount.mailbox.outboxReply.push({ outboxId: id });
      foundSenderAccount.mailbox.outboxReply.push({ outboxId: id, replyId: [savedEmailOut._id] });
      foundSenderAccount.mailbox.inboxReply.push({ inboxId: id });

      let read = foundReceiverAccount.mailbox.read;
      for (let i = 0; i < read.length; i++) {
        if (read[i].equals(id)) {
          read.splice(i, 1);
          break;
        }
      }
    } else {
      foundSenderAccount.mailbox.outbox.push(id);
      foundReceiverAccount.mailbox.inbox.push(id);

      let inbox = foundSenderAccount.mailbox.inbox;
      for (let i = 0; i < inbox.length; i++) {
        if (inbox[i].equals(id)) {
          inbox.splice(i, 1);
          break;
        }
      }

      let outbox = foundReceiverAccount.mailbox.outbox;
      for (let i = 0; i < outbox.length; i++) {
        if (outbox[i].equals(id)) {
          outbox.splice(i, 1);
          break;
        }
      }

      foundReceiverAccount.mailbox.inboxReply.forEach((inbox) => {
        if (inbox.inboxId == id) {
          inbox.replyId.push(replyId);
          inbox.replyId.push(savedEmailOut._id);
        }
      });

      foundSenderAccount.mailbox.outboxReply.forEach((outbox) => {
        if (outbox.outboxId == id) {
          outbox.replyId.push(replyId);
          outbox.replyId.push(savedEmailOut._id);
        }
      });

      let receiverRead = foundReceiverAccount.mailbox.read;
      for (let i = 0; i < receiverRead.length; i++) {
        if (receiverRead[i].equals(id)) {
          receiverRead.splice(i, 1);
          break;
        }
      }

      let senderRead = foundSenderAccount.mailbox.read;
      for (let i = 0; i < senderRead.length; i++) {
        if (senderRead[i].equals(id)) {
          senderRead.splice(i, 1);
          break;
        }
      }
    }

    await foundSenderAccount.save();
    await foundReceiverAccount.save();
  } catch (error) {
    console.log(error);
    response.status(500);
  }
};

const saveDraft = async (request, response, next) => {
  try {
    // construct new draft
    let newDraft = new Email({
      from: request.body.from,
      to: request.body.to,
      subject: request.body.subject,
      message: request.body.message,
    });

    // save constructed draft
    const savedDraft = await newDraft.save();
    console.log('Draft saved', savedDraft);

    response.status(201).json({ message: 'Draft saved', draft: savedDraft });

    // this runs after the response has been sent to the client
    // find the user and update its email IDs
    const foundAccount = await Account.findOne({ _id: request.user });
    foundAccount.mailbox.drafts.push(savedDraft._id);
    await foundAccount.save();
  } catch (error) {
    console.log(error);
    response.status(500);
  }
};

const updateDraft = async (request, response, next) => {
  try {
    // find the draft using the id
    let foundDraft = await Email.findOne({ _id: request.params.id });
    if (!foundDraft)
      return response.status(404).json({ message: 'Email not found', id: request.params.id });

    // update its contents
    foundDraft.to = request.body.to;
    foundDraft.subject = request.body.subject;
    foundDraft.message = request.body.message;

    // save the draft
    const savedDraft = await foundDraft.save();
    console.log('Draft updated', savedDraft);

    response.status(200).json({ message: 'Draft updated', draft: savedDraft });
  } catch (error) {
    console.log(error);
    response.status(500);
  }
};

const moveToTrash = async (request, response, next) => {
  try {
    // find the user by ID
    const foundUser = await Account.findOne({ _id: request.user });

    // locate the email in inbox/outbox/drafts and move it to trash
    let { inbox, outbox, drafts, trash, favorite } = foundUser.mailbox;
    let isEmailFound = false;

    if (!isEmailFound)
      // search favorite
      for (let i = 0; i < favorite.length; i++) {
        if (favorite[i].equals(request.params.id)) {
          favorite.splice(i, 1);
          console.log('Unfavorited Mail', request.params.id);
          break;
        }
      }

    if (!isEmailFound)
      // search inbox
      for (let i = 0; i < inbox.length; i++) {
        if (inbox[i].equals(request.params.id)) {
          trash.push(inbox[i]);
          inbox.splice(i, 1);
          console.log('Moved from inbox to trash', request.params.id);
          isEmailFound = true;
          break;
        }
      }

    if (!isEmailFound)
      // search outbox
      for (let i = 0; i < outbox.length; i++) {
        if (outbox[i].equals(request.params.id)) {
          trash.push(outbox[i]);
          outbox.splice(i, 1);
          console.log('Moved from outbox to trash', request.params.id);
          isEmailFound = true;
          break;
        }
      }

    if (!isEmailFound)
      // search drafts
      for (let i = 0; i < drafts.length; i++) {
        if (drafts[i].equals(request.params.id)) {
          trash.push(drafts[i]);
          drafts.splice(i, 1);
          console.log('Moved from drafts to trash', request.params.id);
          isEmailFound = true;
          break;
        }
      }

    // save changes, then populate the mailbox for the client
    const savedUser = await foundUser.save();
    const { mailbox } = await Account.populate(
      savedUser,
      'mailbox.inbox mailbox.outbox mailbox.drafts mailbox.trash mailbox.favorite',
    );

    response.status(200).json({ message: 'Moved to trash', mailbox });
  } catch (error) {
    console.log(error);
    response.status(500);
  }
};

const removeFromTrash = async (request, response, next) => {
  try {
    // find the user by ID
    const foundUser = await Account.findOne({ _id: request.user }).populate(
      'mailbox.inbox mailbox.outbox mailbox.drafts mailbox.trash',
    );

    // locate the email in trash and return it to its relative category
    const { inbox, outbox, drafts, trash } = foundUser.mailbox;
    for (let i = 0; i < trash.length; i++) {
      // if the IDs match, the email was found in the current loop
      if (trash[i]._id.equals(request.params.id)) {
        if (trash[i].to === '' || trash[i].subject === '' || trash[i].message === '') {
          // email origin is drafts
          drafts.push(trash[i]._id);
          trash.splice(i, 1);
          console.log('Moved from trash to drafts', request.params.id);
        } else if (trash[i].from === foundUser.email) {
          // email origin is outbox
          outbox.push(trash[i]._id);
          trash.splice(i, 1);
          console.log('Moved from trash to outbox', request.params.id);
        } else {
          // email origin is inbox
          inbox.push(trash[i]._id);
          trash.splice(i, 1);
          console.log('Moved from trash to inbox', request.params.id);
        }

        break;
      }
    }

    // save changes, then populate the mailbox for the client
    const savedUser = await foundUser.save();
    const { mailbox } = await Account.populate(
      savedUser,
      'mailbox.inbox mailbox.outbox mailbox.drafts mailbox.trash',
    );

    response.status(200).json({ message: 'Removed from trash', mailbox });
  } catch (error) {
    console.log(error);
    response.status(500);
  }
};

const toggleEmailProperty = async (request, response, next) => {
  try {
    // find the email by id
    const foundEmail = await Email.findOne({ _id: request.params.id });
    if (!foundEmail)
      return response.status(404).json({ message: 'Email not found', id: request.params.id });

    const foundAccount = await Account.findOne({ _id: request.user });
    // update its chosen property
    switch (request.params.toggle) {
      case 'read':
        foundAccount.mailbox.read.push(request.params.id);
        foundAccount.save();
        break;
      case 'unread':
        let read = foundAccount.mailbox.read;
        for (let i = 0; i < read.length; i++) {
          if (read[i].equals(request.params.id)) {
            read.splice(i, 1);
            break;
          }
        }
        foundAccount.save();
        break;
      case 'favorite':
        foundAccount.mailbox.favorite.push(request.params.id);
        foundAccount.save();
        break;
      case 'unfavorite':
        let favorite = foundAccount.mailbox.favorite;
        for (let i = 0; i < favorite.length; i++) {
          if (favorite[i].equals(request.params.id)) {
            favorite.splice(i, 1);
            break;
          }
        }
        foundAccount.save();
        break;
      default:
        return response.status(404).json({ message: "Wrong params, can't parse request" });
    }

    // return the email
    response
      .status(200)
      .json({ message: `${request.params.toggle} status updated`, email: foundEmail });
  } catch (error) {
    console.log(error);
    response.status(500);
  }
};

const deleteEmail = async (request, response, next) => {
  try {
    // find the email by id and delete it
    await Email.deleteOne({ _id: request.params.id });
    console.log('Email deleted', request.params.id);

    // return the email ID (so the client can remove the email from a state)
    response.status(200).json({ message: 'Email deleted', id: request.params.id });

    // this runs after the response has been sent to the client
    // find the user and update its email IDs
    const foundAccount = await Account.findOne({ _id: request.user });
    let isEmailFound = false;
    let trashbox = foundAccount.mailbox.trash;
    for (let i = 0; i < trashbox.length; i++) {
      if (trashbox[i].equals(request.params.id)) {
        trashbox.splice(i, 1);
        isEmailFound = true;
        break;
      }
    }
    if (!isEmailFound) {
      let drafts = foundAccount.mailbox.drafts;
      for (let i = 0; i < drafts.length; i++) {
        if (drafts[i].equals(request.params.id)) {
          drafts.splice(i, 1);
          break;
        }
      }
    }

    let read = foundAccount.mailbox.read;
    for (let i = 0; i < read.length; i++) {
      if (read[i].equals(request.params.id)) {
        read.splice(i, 1);
        break;
      }
    }

    await foundAccount.save();
  } catch (error) {
    console.log(error);
    response.status(500);
  }
};

module.exports = {
  getAllEmails,
  sendEmail,
  saveDraft,
  updateDraft,
  moveToTrash,
  removeFromTrash,
  toggleEmailProperty,
  deleteEmail,
};