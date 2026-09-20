// services/tradesafe.service.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class TradeSafeService {
  constructor() {
    this.apiUrl = process.env.TRADESAFE_API_URL || 'https://api-developer.tradesafe.dev/graphql';
    this.authUrl = 'https://auth.tradesafe.co.za/oauth/token';
    this.clientId = process.env.TRADESAFE_CLIENT_ID;
    this.clientSecret = process.env.TRADESAFE_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiry = null;

    if (!this.clientId || !this.clientSecret) {
      console.warn('⚠️ TRADESAFE_CLIENT_ID / TRADESAFE_CLIENT_SECRET not set in env.');
    }

    this.logDir = path.join(__dirname, '../logs/tradesafe');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  _logToFile(type, data) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${type}_${timestamp}.json`;
      const filepath = path.join(this.logDir, filename);
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('TradeSafe log write failed:', error.message);
    }
  }

  _logApiCall(method, payload, response, error = null) {
    const logData = {
      timestamp: new Date().toISOString(),
      method,
      payload,
      response,
      error,
      environment: process.env.NODE_ENV || 'development',
      apiUrl: this.apiUrl,
    };
    this._logToFile(method, logData);
    return logData;
  }

  async _getAccessToken() {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > Date.now()) {
      return this.accessToken;
    }

    const payload = {
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    };

    try {
      const response = await axios.post(this.authUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
      return this.accessToken;
    } catch (error) {
      this._logApiCall('getAccessToken', payload, null, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw new Error(`Authentication failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async _executeQuery(query, variables = {}) {
    const payload = { query, variables };

    try {
      const token = await this._getAccessToken();

      const response = await axios.post(
        this.apiUrl,
        { query, variables },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          timeout: 50000,
        }
      );

      const responseData = response.data;
      this._logApiCall('executeQuery', payload, responseData);

      if (responseData?.errors?.length > 0) {
        const err = responseData.errors[0];
        console.error('❌ TradeSafe GraphQL error:', err.message);
        throw new Error(err.message);
      }

      return responseData.data;
    } catch (error) {
      this._logApiCall('executeQuery', payload, null, {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack,
      });
      throw error;
    }
  }

  // ========== REGISTER CREATOR ==========
  async registerCreator(userData, bankAccount) {
    const bankName = bankAccount.bankName || bankAccount.bank || bankAccount.bankCode;

    if (!userData.phoneNumber) {
      throw new Error('registerCreator requires a real phoneNumber; refusing to use a placeholder.');
    }

    const mutation = `
      mutation tokenCreate($input: TokenInput!) {
        tokenCreate(input: $input) {
          id
          name
          reference
        }
      }
    `;

    const input = {
      user: {
        givenName: userData.firstName || 'Creator',
        familyName: userData.lastName || '',
        email: userData.email,
        mobile: userData.phoneNumber,
        idNumber: userData.idNumber || '',
        idType: userData.isSouthAfricanCitizen ? 'NATIONAL' : 'PASSPORT',
        idCountry: 'ZAF',
      },
      bankAccount: {
        bank: bankName,
        accountNumber: bankAccount.accountNumber,
        accountType: bankAccount.accountType || 'CHEQUE',
      },
    };

    const result = await this._executeQuery(mutation, { input });
    this._logApiCall('registerCreator', input, result);
    return result.tokenCreate;
  }

  // ========== REGISTER BRAND ==========
  async registerBrand(userData) {
    if (!userData.phoneNumber) {
      throw new Error('registerBrand requires a real phoneNumber; refusing to use a placeholder.');
    }

    const mutation = `
      mutation tokenCreate($input: TokenInput!) {
        tokenCreate(input: $input) {
          id
          name
          reference
        }
      }
    `;

    const input = {
      user: {
        givenName: userData.firstName || 'Brand',
        familyName: userData.lastName || '',
        email: userData.email,
        mobile: userData.phoneNumber,
        idNumber: userData.idNumber || '',
        idType: 'NATIONAL',
        idCountry: 'ZAF',
      },
      organization: {
        name: userData.organizationName || 'My Company',
        type: userData.organizationType || 'PRIVATE',
        registrationNumber: userData.registrationNumber || '',
        taxNumber: userData.taxNumber || '',
      },
    };

    if (!input.organization.registrationNumber) delete input.organization.registrationNumber;
    if (!input.organization.taxNumber) delete input.organization.taxNumber;

    if (userData.bankAccount) {
      input.bankAccount = {
        bank: userData.bankAccount.bank,
        accountNumber: userData.bankAccount.accountNumber,
        accountType: userData.bankAccount.accountType || 'CHEQUE',
      };
    }

    const result = await this._executeQuery(mutation, { input });
    this._logApiCall('registerBrand', input, result);
    return result.tokenCreate;
  }

  // ========== GET TOKEN STATUS ==========
  async getTokenStatus(tokenId) {
    const query = `
      query getToken($tokenId: ID!) {
        token(id: $tokenId) {
          id
          name
          reference
          user { givenName familyName email mobile }
          organization { name type registration taxNumber }
          balance
        }
      }
    `;

    const result = await this._executeQuery(query, { tokenId });
    this._logApiCall('getTokenStatus', { tokenId }, result);
    return result.token;
  }

  // ========== ORGANIZATION MANAGEMENT ==========
  async getOrganizations() {
    const query = `
      query organizations {
        organizations { id name type registration taxNumber status }
      }
    `;
    const result = await this._executeQuery(query);
    this._logApiCall('getOrganizations', {}, result);
    return result.organizations || [];
  }

  async addUserToOrganization(userId, organizationId, role = 'MEMBER') {
    const mutation = `
      mutation addUserToOrganization($input: AddUserToOrganizationInput!) {
        addUserToOrganization(input: $input) {
          id
          name
          email
          role
        }
      }
    `;
    const input = { userId, organizationId, role };
    const result = await this._executeQuery(mutation, { input });
    this._logApiCall('addUserToOrganization', input, result);
    return result.addUserToOrganization;
  }

  // ========== TRANSACTION MANAGEMENT ==========
  async transactionCreate({
    title,
    description,
    parties,
    allocations,
    feeAllocation = 'BUYER',
  }) {
    if (!parties || !allocations) {
      throw new Error('transactionCreate requires explicit parties and allocations.');
    }

    const mutation = `
      mutation transactionCreate($input: CreateTransactionInput!) {
        transactionCreate(input: $input) {
          id
          title
          state
          createdAt
          parties {
            id
            name
            role
            details { user { givenName familyName email } }
          }
          allocations {
            id
            title
            state
            value
            calculation {
              value
              payout
              fee
              refund
            }
          }
        }
      }
    `;

    const input = {
      title: title || 'Campaign Payment',
      description: description || 'Payment for campaign services',
      industry: 'GENERAL_GOODS_SERVICES',
      currency: 'ZAR',
      feeAllocation,
      workflow: 'STANDARD',
      parties,
      allocations,
    };

    const result = await this._executeQuery(mutation, { input });
    this._logApiCall('transactionCreate', input, result);
    return result.transactionCreate;
  }

  async transactionCancel(transactionId, options = {}) {
    const mutation = `
    mutation transactionCancel($id: ID!, $comment: String) {
      transactionCancel(id: $id, comment: $comment) { id state }
    }
  `;

    const variables = { id: transactionId };
    if (options.comment) variables.comment = options.comment;

    const result = await this._executeQuery(mutation, variables);
    this._logApiCall('transactionCancel', variables, result);
    return result.transactionCancel;
  }

  // ========== DELIVERY MUTATIONS ==========
  async allocationStartDelivery(allocationId) {
    const mutation = `
      mutation allocationStartDelivery($id: ID!) {
        allocationStartDelivery(id: $id) { id state }
      }
    `;
    const result = await this._executeQuery(mutation, { id: allocationId });
    this._logApiCall('allocationStartDelivery', { allocationId }, result);
    return result.allocationStartDelivery;
  }

  async allocationAcceptDelivery(allocationId) {
    const mutation = `
      mutation allocationAcceptDelivery($id: ID!) {
        allocationAcceptDelivery(id: $id) { id state }
      }
    `;
    const result = await this._executeQuery(mutation, { id: allocationId });
    this._logApiCall('allocationAcceptDelivery', { allocationId }, result);
    return result.allocationAcceptDelivery;
  }

  // ========== TOKEN DEPOSIT ==========
  async tokenDeposit(tokenId, options = {}) {
    console.log("💰 tokenDeposit STARTED");
    console.log("   Token ID:", tokenId);
    console.log("   Value:", options.value);
    console.log("   Payment Methods:", options.paymentMethods);

    const mutation = `
    mutation tokenDeposit($id: ID!, $embed: Boolean, $minutes: Int, $paymentMethods: [PaymentGateway!], $value: Int) {
      tokenDeposit(id: $id, embed: $embed, minutes: $minutes, paymentMethods: $paymentMethods, value: $value) {
        id
        url
        expiresAt
      }
    }
  `;

    const variables = {
      id: tokenId,
      embed: options.embed || false,
      minutes: options.minutes || 30,
    };

    if (options.paymentMethods?.length) {
      variables.paymentMethods = options.paymentMethods;
    }

    // ✅ Add value (integer, rands)
    if (options.value !== undefined && options.value !== null) {
      variables.value = Math.round(Number(options.value));
    }

    try {
      const result = await this._executeQuery(mutation, variables);
      this._logApiCall('tokenDeposit', variables, result);
      console.log("✅ tokenDeposit COMPLETED");
      console.log("   URL:", result.tokenDeposit?.url);
      return result.tokenDeposit;
    } catch (error) {
      console.error("❌ tokenDeposit failed:", error.message);
      throw error;
    }
  }

  // ========== DEPOSIT FROM WALLET ==========
  async transactionDepositWallet(transactionId) {
    const mutation = `
      mutation transactionDepositWallet($id: ID!) {
        transactionDepositWallet(id: $id) { id state }
      }
    `;
    const result = await this._executeQuery(mutation, { id: transactionId });
    this._logApiCall('transactionDepositWallet', { transactionId }, result);
    return result.transactionDepositWallet;
  }

  // ========== READS ==========
  async getTransaction(transactionId) {
    const query = `
      query getTransaction($transactionId: ID!) {
        transaction(id: $transactionId) {
          id
          title
          state
          createdAt
          parties {
            id
            name
            role
            details {
              tokenId
              user {
                givenName
                familyName
                email
              }
            }
          }
          allocations {
            id
            title
            state
            value
          }
        }
      }
    `;
    const result = await this._executeQuery(query, { transactionId });
    this._logApiCall('getTransaction', { transactionId }, result);
    return result.transaction;
  }

  async getTransactions({ page = 1, limit = 10 } = {}) {
    const query = `
      query getTransactions($page: Int, $limit: Int) {
        transactions(page: $page, limit: $limit) {
          data { id title state createdAt }
          pagination { total page limit pages }
        }
      }
    `;
    const result = await this._executeQuery(query, { page, limit });
    this._logApiCall('getTransactions', { page, limit }, result);
    return result.transactions;
  }

  async getAllocation(allocationId) {
    const query = `
      query allocation($id: ID!) {
        allocation(id: $id) {
          id
          state
          value
          calculation {
            value
            payout
            fee
            refund
          }
          transaction { id state }
        }
      }
    `;
    const result = await this._executeQuery(query, { id: allocationId });
    this._logApiCall('getAllocation', { allocationId }, result);
    return result.allocation;
  }

  // ========== SCHEMA INTROSPECTION ==========
  async introspectEnum(enumName) {
    const query = `
      query introspectEnum($name: String!) {
        __type(name: $name) {
          name
          enumValues { name description }
        }
      }
    `;
    const result = await this._executeQuery(query, { name: enumName });
    return result.__type;
  }

  // ========== SANDBOX-ONLY: TOKEN UPDATE BALANCE ==========
  async tokenUpdateBalance({ id, value, type = 'CREDIT' }) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'tokenUpdateBalance is a TradeSafe SANDBOX-ONLY mutation and is disabled in production.'
      );
    }

    console.log("💰 tokenUpdateBalance STARTED (SANDBOX ONLY)");
    console.log("   Token ID:", id);
    console.log("   Value:", value);
    console.log("   Type:", type);

    const mutation = `
      mutation tokenUpdateBalance($id: ID!, $value: Float!, $type: TransactionType!) {
        tokenUpdateBalance(id: $id, value: $value, type: $type) {
          id
          balance
        }
      }
    `;

    try {
      const result = await this._executeQuery(mutation, { id, value, type });
      this._logApiCall('tokenUpdateBalance', { id, value, type }, result);
      console.log("✅ tokenUpdateBalance COMPLETED");
      console.log("   New Balance:", result.tokenUpdateBalance?.balance);
      return result.tokenUpdateBalance;
    } catch (error) {
      console.error("❌ tokenUpdateBalance failed:", error.message);
      throw error;
    }
  }



  // ========== TOKEN ACCOUNT WITHDRAWAL ==========

  async tokenAccountWithdraw({ tokenId, value, rtc = false }) {
    console.log("💰 tokenAccountWithdraw STARTED");
    console.log("   Token ID:", tokenId);
    console.log("   Value:", value);
    console.log("   RTC:", rtc);

    // ✅ tokenAccountWithdraw returns Boolean — no sub-selection
    const mutation = `
    mutation tokenAccountWithdraw($id: ID!, $value: Float, $rtc: Boolean) {
      tokenAccountWithdraw(id: $id, value: $value, rtc: $rtc)
    }
  `;

    const variables = {
      id: tokenId,
      value,
      rtc,
    };

    try {
      const result = await this._executeQuery(mutation, variables);
      this._logApiCall('tokenAccountWithdraw', variables, result);
      console.log("✅ tokenAccountWithdraw COMPLETED");
      console.log("   Result:", result.tokenAccountWithdraw);
      return result.tokenAccountWithdraw; // true/false
    } catch (error) {
      console.error("❌ tokenAccountWithdraw failed:", error.message);
      throw error;
    }
  }


}

module.exports = new TradeSafeService();