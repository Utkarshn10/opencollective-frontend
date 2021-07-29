import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { defineMessages, useIntl } from 'react-intl';

import { Box } from '../Grid';
import StyledInputGroup from '../StyledInputGroup';
import StyledSelect from '../StyledSelect';
import { Label } from '../Text';

const messages = defineMessages({
  cryptoCurrency: {
    id: `CryptoStepDetails.cryptoCurrency`,
    defaultMessage: 'Select your currency',
  },
  donationAmount: {
    id: `CryptoStepDetails.donationAmount`,
    defaultMessage: 'Enter donation amount',
  },
  invalidAmount: {
    id: `CryptoStepDetails.invalidAmount`,
    defaultMessage: 'Please select a valid currency amount',
  },
});

export const cryptoCurrencies = [
  {
    label: 'BTC',
    value: 'BTC',
  },
  {
    label: 'ETH',
    value: 'ETH',
  },
  {
    label: 'BCH',
    value: 'BCH',
  },
  {
    label: 'LTC',
    value: 'LTC',
  },
  {
    label: 'ZEC',
    value: 'ZEC',
  },
  {
    label: 'LINK',
    value: 'LINK',
  },
  {
    label: 'BAT',
    value: 'BAT',
  },
  {
    label: 'DAI',
    value: 'DAI',
  },
  {
    label: 'OXT',
    value: 'OXT',
  },
  {
    label: 'STORJ',
    value: 'STORJ',
  },
  {
    label: 'AMP',
    value: 'AMP',
  },
  {
    label: 'ZRX',
    value: 'ZRX',
  },
];

const CryptoStepDetails = ({ onChange, data }) => {
  const intl = useIntl();
  const [currencyType, setCurrencyType] = useState(data.currency);
  const [amount, setAmount] = useState(data.amount);
  const dispatchChange = (field, value) => {
    onChange({ stepDetails: { ...data, [field]: value }, stepSummary: null });
  };
  return (
    <Box width={1}>
      <Label htmlFor="crypto-currency" mb={2}>
        {intl.formatMessage(messages['cryptoCurrency'])}
      </Label>
      <StyledSelect
        inputId="crypto-currency"
        options={cryptoCurrencies}
        defaultValue={currencyType}
        onChange={value => {
          setCurrencyType(value);
          dispatchChange('currency', value);
        }}
        isSearchable={false}
        maxWidth={'100%'}
        mb={3}
      />
      <Label htmlFor="donation-amount" mb={2}>
        {intl.formatMessage(messages['donationAmount'])}
      </Label>
      <StyledInputGroup
        prepend={currencyType.label}
        type="number"
        inputMode="decimal"
        defaultValue={amount}
        onChange={({ target }) => {
          setAmount(target.value);
          dispatchChange('amount', target.value);
        }}
        error={amount <= 0 && intl.formatMessage(messages['invalidAmount'])}
      />
    </Box>
  );
};

CryptoStepDetails.propTypes = {
  onChange: PropTypes.func,
  data: PropTypes.shape({
    amount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    currency: PropTypes.object,
  }),
};

export default CryptoStepDetails;
