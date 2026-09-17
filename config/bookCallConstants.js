const BOOK_CALL_STATUSES = ["new", "in_progress", "resolved"];

const getRecipientEmailForBookCall = () => {
  return (
    process.env.BOOK_CALL_ADMIN_EMAIL ||
    process.env.ADMIN_CONTACT_EMAIL ||
    process.env.ADMIN_EMAIL ||
    "hello@creatrend.co.za"
  );
};

module.exports = {
  BOOK_CALL_STATUSES,
  getRecipientEmailForBookCall,
};
