const {
  createBankChangeRequestService,
  getMyBankChangeRequestsService,
} = require('../services/bankChangeService');


exports.createBankChangeRequest = async (req, res) => {
  const result = await createBankChangeRequestService(req);
  res.status(result.code || 200).json(result);
};

exports.getMyBankChangeRequests = async (req, res) => {
  const result = await getMyBankChangeRequestsService(req);
  res.status(result.code || 200).json(result);
};