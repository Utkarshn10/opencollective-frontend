import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useMutation } from '@apollo/client';
import { CreditCard } from '@styled-icons/boxicons-regular/CreditCard';
import { Dollar } from '@styled-icons/boxicons-regular/Dollar';
import { XCircle } from '@styled-icons/boxicons-regular/XCircle';
import themeGet from '@styled-system/theme-get';
import { FormattedMessage } from 'react-intl';
import styled from 'styled-components';

import { getErrorFromGraphqlException } from '../../lib/errors';
import { API_V2_CONTEXT, gqlV2 } from '../../lib/graphql/helpers';

import { Flex } from '../Grid';
import I18nFormatters from '../I18nFormatters';
import StyledButton from '../StyledButton';
import StyledHr from '../StyledHr';
import { slideInUp } from '../StyledKeyframes';
import { P } from '../Text';
import { TOAST_TYPE, useToasts } from '../ToastProvider';
import { withUser } from '../UserProvider';

import UpdateOrderPopUp from './UpdateOrderPopUp';
import UpdatePaymentMethodPopUp from './UpdatePaymentMethodPopUp';

//  Styled components
const RedXCircle = styled(XCircle)`
  color: ${themeGet('colors.red.500')};
`;

const GrayXCircle = styled(XCircle)`
  color: ${themeGet('colors.black.500')};
  cursor: pointer;
`;

const MenuItem = styled(Flex).attrs({
  px: 3,
})`
  cursor: pointer;
`;

const PopUpMenu = styled(Flex)`
  position: absolute;
  bottom: 0;
  z-index: 998;
  background: white;
  border-radius: 8px;
  box-shadow: 0px 2px 7px rgba(0, 0, 0, 0.5);
  min-height: 180px;
  max-height: 360px;
  width: 100%;
  overflow-y: auto;
  padding: 4px 0;
  animation: ${slideInUp} 0.2s;
`;

const MenuSection = styled(Flex).attrs({
  flexDirection: 'column',
  width: 1,
})``;

// GraphQL
const cancelRecurringContributionMutation = gqlV2/* GraphQL */ `
  mutation CancelRecurringContribution($order: OrderReferenceInput!) {
    cancelOrder(order: $order) {
      id
      status
    }
  }
`;

const RecurringContributionsPopUp = ({ contribution, status, onCloseEdit, account }) => {
  const { addToast } = useToasts();
  const [menuState, setMenuState] = useState('mainMenu');
  const [submitCancellation, { loading: loadingCancellation }] = useMutation(cancelRecurringContributionMutation, {
    context: API_V2_CONTEXT,
  });

  const mainMenu = menuState === 'mainMenu' && (status === 'ACTIVE' || status === 'ERROR');
  const cancelMenu = menuState === 'cancelMenu';
  const updateOrderMenu = menuState === 'updateOrderMenu';
  const paymentMethodMenu = menuState === 'paymentMethodMenu';

  return (
    <PopUpMenu data-cy="recurring-contribution-menu">
      {mainMenu && (
        <MenuSection>
          <Flex flexGrow={1 / 4} width={1} alignItems="center" justifyContent="center" px={3}>
            <P my={2} fontSize="12px" textTransform="uppercase" color="black.700">
              <FormattedMessage id="header.options" defaultMessage="Options" />
            </P>
            <Flex flexGrow={1} alignItems="center">
              <StyledHr width="100%" mx={2} />
            </Flex>
            <GrayXCircle size={26} onClick={onCloseEdit} />
          </Flex>
          {account.type !== 'COLLECTIVE' && (
            <MenuItem
              flexGrow={1 / 4}
              width={1}
              alignItems="center"
              justifyContent="space-around"
              onClick={() => {
                setMenuState('paymentMethodMenu');
              }}
              data-cy="recurring-contribution-menu-payment-option"
            >
              <Flex width={1 / 6}>
                <CreditCard size={20} />
              </Flex>
              <Flex flexGrow={1}>
                <P fontSize="14px" fontWeight="400">
                  <FormattedMessage id="subscription.menu.editPaymentMethod" defaultMessage="Update payment method" />
                </P>
              </Flex>
            </MenuItem>
          )}
          <MenuItem
            flexGrow={1 / 4}
            width={1}
            alignItems="center"
            justifyContent="space-between"
            onClick={() => {
              setMenuState('updateOrderMenu');
            }}
            data-cy="recurring-contribution-menu-tier-option"
          >
            <Flex width={1 / 6}>
              <Dollar size={20} />
            </Flex>
            <Flex flexGrow={1}>
              <P fontSize="14px" fontWeight="400">
                <FormattedMessage id="subscription.menu.updateAmount" defaultMessage="Update amount" />
              </P>
            </Flex>
          </MenuItem>
          <MenuItem
            flexGrow={1 / 4}
            width={1}
            alignItems="center"
            justifyContent="center"
            onClick={() => {
              setMenuState('cancelMenu');
            }}
            data-cy="recurring-contribution-menu-cancel-option"
          >
            <Flex width={1 / 6}>
              <RedXCircle size={20} />
            </Flex>
            <Flex flexGrow={1}>
              <P fontSize="14px" fontWeight="400" color="red.500">
                <FormattedMessage id="subscription.menu.cancelContribution" defaultMessage="Cancel contribution" />
              </P>
            </Flex>
          </MenuItem>
        </MenuSection>
      )}

      {cancelMenu && (
        <MenuSection data-cy="recurring-contribution-cancel-menu">
          <Flex flexGrow={1 / 4} width={1} alignItems="center" justifyContent="center" px={3}>
            <P my={2} fontSize="12px" textTransform="uppercase" color="black.700">
              <FormattedMessage id="subscription.menu.cancelContribution" defaultMessage="Cancel contribution" />
            </P>
            <Flex flexGrow={1} alignItems="center">
              <StyledHr width="100%" mx={2} />
            </Flex>
            <GrayXCircle size={26} onClick={onCloseEdit} />
          </Flex>
          <Flex flexGrow={1 / 4} width={1} alignItems="center" justifyContent="center">
            <P fontSize="14px" fontWeight="400">
              <FormattedMessage id="subscription.menu.cancel.yes" defaultMessage="Are you sure? 🥺" />
            </P>
          </Flex>
          <Flex flexGrow={1 / 4} width={1} alignItems="center" justifyContent="center">
            <Flex flexGrow={1} alignItems="center">
              <StyledHr width="100%" />
            </Flex>
          </Flex>
          <Flex flexGrow={1 / 4} width={1} alignItems="center" justifyContent="center">
            <StyledButton
              buttonSize="tiny"
              minWidth={75}
              loading={loadingCancellation}
              data-cy="recurring-contribution-cancel-yes"
              onClick={async () => {
                try {
                  await submitCancellation({ variables: { order: { id: contribution.id } } });
                  onCloseEdit();
                  addToast({
                    type: TOAST_TYPE.INFO,
                    message: (
                      <FormattedMessage
                        id="subscription.createSuccessCancel"
                        defaultMessage="Your recurring contribution has been <strong>cancelled</strong>."
                        values={I18nFormatters}
                      />
                    ),
                  });
                } catch (error) {
                  const errorMsg = getErrorFromGraphqlException(error).message;
                  addToast({ type: TOAST_TYPE.ERROR, message: errorMsg });
                }
              }}
            >
              <FormattedMessage id="yes" defaultMessage="Yes" />
            </StyledButton>
            <StyledButton
              ml={2}
              minWidth={95}
              buttonSize="tiny"
              buttonStyle="secondary"
              disabled={loadingCancellation}
              onClick={() => setMenuState('mainMenu')}
              data-cy="recurring-contribution-cancel-no"
            >
              <FormattedMessage id="subscription.menu.cancel.no" defaultMessage="No, wait" />
            </StyledButton>
          </Flex>
        </MenuSection>
      )}

      {paymentMethodMenu && (
        <MenuSection data-cy="recurring-contribution-payment-menu">
          <UpdatePaymentMethodPopUp
            setMenuState={setMenuState}
            contribution={contribution}
            onCloseEdit={onCloseEdit}
            account={contribution.fromAccount || account}
          />
        </MenuSection>
      )}

      {updateOrderMenu && (
        <MenuSection data-cy="recurring-contribution-order-menu">
          <UpdateOrderPopUp setMenuState={setMenuState} contribution={contribution} onCloseEdit={onCloseEdit} />
        </MenuSection>
      )}
    </PopUpMenu>
  );
};

RecurringContributionsPopUp.propTypes = {
  contribution: PropTypes.object.isRequired,
  LoggedInUser: PropTypes.object.isRequired,
  status: PropTypes.string.isRequired,
  onCloseEdit: PropTypes.func,
  account: PropTypes.object.isRequired,
};

export default withUser(RecurringContributionsPopUp);
