const router = require('express').Router();
const { authenticateToken } = require('../middleware/authToken.js');
const { emailValidations } = require('../middleware/validations.js');
const {
  getAllEmails,
  sendEmail,
  saveDraft,
  updateDraft,
  moveToTrash,
  removeFromTrash,
  toggleEmailProperty,
  deleteEmail,
} = require('../controllers/email.js');


router.get('/', authenticateToken, getAllEmails);
router.post('/send/:id/:replyId', authenticateToken, [...emailValidations], sendEmail);
router.post('/draft', authenticateToken, saveDraft);
router.put('/draft/:id', authenticateToken, updateDraft);
router.put('/:id/trash', authenticateToken, moveToTrash);
router.put('/:id/untrash', authenticateToken, removeFromTrash);
router.put('/:id/:toggle', authenticateToken, toggleEmailProperty);
router.delete('/:id', authenticateToken, deleteEmail);

module.exports = router;
