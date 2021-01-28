import React from 'react';
import PropTypes from 'prop-types';
import { Field, FieldArray, Form, Formik } from 'formik';
import { first, isEmpty, omit, pick } from 'lodash';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import styled from 'styled-components';

import { CollectiveType } from '../../lib/constants/collectives';
import expenseStatus from '../../lib/constants/expense-status';
import expenseTypes from '../../lib/constants/expenseTypes';
import { PayoutMethodType } from '../../lib/constants/payout-method';
import { requireFields } from '../../lib/form-utils';
import { flattenObjectDeep } from '../../lib/utils';

import { Box, Flex } from '../Grid';
import PrivateInfoIcon from '../icons/PrivateInfoIcon';
import LoadingPlaceholder from '../LoadingPlaceholder';
import StyledButton from '../StyledButton';
import StyledCard from '../StyledCard';
import StyledHr from '../StyledHr';
import StyledInput from '../StyledInput';
import StyledInputField from '../StyledInputField';
import StyledInputTags from '../StyledInputTags';
import StyledTextarea from '../StyledTextarea';
import { P, Span } from '../Text';

import ExpenseAttachedFilesForm from './ExpenseAttachedFilesForm';
import ExpenseFormItems, { addNewExpenseItem } from './ExpenseFormItems';
import ExpenseFormPayeeSignUpStep from './ExpenseFormPayeeSignUpStep';
import ExpenseFormPayeeStep from './ExpenseFormPayeeStep';
import { validateExpenseItem } from './ExpenseItemForm';
import ExpensePayeeDetails from './ExpensePayeeDetails';
import ExpenseTypeRadioSelect from './ExpenseTypeRadioSelect';
import ExpenseTypeTag from './ExpenseTypeTag';
import { validatePayoutMethod } from './PayoutMethodForm';

const msg = defineMessages({
  descriptionPlaceholder: {
    id: `ExpenseForm.DescriptionPlaceholder`,
    defaultMessage: 'Enter expense title here...',
  },
  grantSubjectPlaceholder: {
    id: `ExpenseForm.GrantSubjectPlaceholder`,
    defaultMessage: 'i.e. research, software development, etc...',
  },
  addNewReceipt: {
    id: 'ExpenseForm.AddReceipt',
    defaultMessage: 'Add new receipt',
  },
  addNewItem: {
    id: 'ExpenseForm.AddLineItem',
    defaultMessage: 'Add new item',
  },
  addNewGrantItem: {
    id: 'ExpenseForm.AddGrantItem',
    defaultMessage: 'Add grant item',
  },
  stepReceipt: {
    id: 'ExpenseForm.StepExpense',
    defaultMessage: 'Upload one or multiple receipt',
  },
  stepInvoice: {
    id: 'ExpenseForm.StepExpenseInvoice',
    defaultMessage: 'Set invoice details',
  },
  stepFundingRequest: {
    id: 'ExpenseForm.StepExpenseFundingRequest',
    defaultMessage: 'Set grant details',
  },
  recipientNoteLabel: {
    id: 'ExpenseForm.RecipientNoteLabel',
    defaultMessage: 'Add a note for the recipient',
  },
  stepPayee: {
    id: 'ExpenseForm.StepPayeeInvoice',
    defaultMessage: 'Payee information',
  },
});

const getDefaultExpense = collective => ({
  description: '',
  longDescription: '',
  items: [],
  attachedFiles: [],
  payee: null,
  payoutMethod: undefined,
  privateMessage: '',
  invoiceInfo: '',
  currency: collective.currency,
  payeeLocation: {
    address: '',
    country: null,
  },
});

/**
 * Take the expense's data as generated by `ExpenseForm` and strips out all optional data
 * like URLs for items when the expense is an invoice.
 */
export const prepareExpenseForSubmit = expenseData => {
  // The collective picker still uses API V1 for when creating a new profile on the fly
  const payeeIdField = typeof expenseData.payee?.id === 'string' ? 'id' : 'legacyId';
  const isInvoice = expenseData.type === expenseTypes.INVOICE;
  const isFundingRequest = expenseData.type === expenseTypes.FUNDING_REQUEST;
  const payee =
    expenseData.payee?.isNewUser || expenseData.payee?.isInvite
      ? pick(expenseData.payee, ['name', 'email', 'organization', 'newsletterOptIn'])
      : { [payeeIdField]: expenseData.payee.id };
  return {
    ...pick(expenseData, ['id', 'description', 'longDescription', 'type', 'privateMessage', 'invoiceInfo', 'tags']),
    payee,
    payoutMethod: pick(expenseData.payoutMethod, ['id', 'name', 'data', 'isSaved', 'type']),
    payeeLocation: isInvoice ? pick(expenseData.payeeLocation, ['address', 'country']) : null,
    attachedFiles: isInvoice ? expenseData.attachedFiles?.map(file => pick(file, ['id', 'url'])) : [],
    // Omit item's ids that were created for keying purposes
    items: expenseData.items.map(item => {
      return pick(item, [
        ...(item.__isNew ? [] : ['id']),
        ...(isInvoice || isFundingRequest ? [] : ['url']), // never submit URLs for invoices or requests
        'description',
        'incurredAt',
        'amount',
      ]);
    }),
  };
};

/**
 * Validate the expense
 */
const validate = expense => {
  if (expense.payee?.isInvite) {
    return expense.payee.id
      ? requireFields(expense, ['description', 'payee', 'payee.id'])
      : requireFields(expense, ['description', 'payee', 'payee.name', 'payee.email']);
  }

  const errors = requireFields(expense, ['description', 'payee', 'payoutMethod', 'currency']);

  if (expense.items.length > 0) {
    const itemsErrors = expense.items.map(item => validateExpenseItem(expense, item));
    const hasErrors = itemsErrors.some(errors => !isEmpty(errors));
    if (hasErrors) {
      errors.items = itemsErrors;
    }
  }

  if (expense.payoutMethod) {
    const payoutMethodErrors = validatePayoutMethod(expense.payoutMethod);
    if (!isEmpty(payoutMethodErrors)) {
      errors.payoutMethod = payoutMethodErrors;
    }
  }

  if (expense.type === expenseTypes.INVOICE) {
    Object.assign(errors, requireFields(expense, ['payeeLocation.country', 'payeeLocation.address']));
  }

  return errors;
};

const setLocationFromPayee = (formik, payee) => {
  formik.setFieldValue('payeeLocation.country', payee.location.country || null);
  formik.setFieldValue('payeeLocation.address', payee.location.address || '');
};

const HiddenFragment = styled.div`
  display: ${({ show }) => (show ? 'block' : 'none')};
`;

const STEPS = {
  PAYEE: 'PAYEE',
  EXPENSE: 'EXPENSE',
};

const ExpenseFormBody = ({
  formik,
  payoutProfiles,
  collective,
  autoFocusTitle,
  onCancel,
  formPersister,
  loggedInAccount,
  loading,
  expensesTags,
  shouldLoadValuesFromPersister,
  isDraft,
}) => {
  const intl = useIntl();
  const { formatMessage } = intl;
  const { values, handleChange, errors, setValues, dirty, touched, setErrors } = formik;
  const hasBaseFormFieldsCompleted = values.type && values.description;
  const isInvite = values.payee?.isInvite;
  const isReceipt = values.type === expenseTypes.RECEIPT;
  const isFundingRequest = values.type === expenseTypes.FUNDING_REQUEST;
  const stepOneCompleted =
    values.payoutMethod &&
    isEmpty(flattenObjectDeep(omit(errors, 'payoutMethod.data.currency'))) &&
    (isReceipt ? true : values.payeeLocation?.country && values.payeeLocation?.address);
  const stepTwoCompleted = isInvite ? true : stepOneCompleted && hasBaseFormFieldsCompleted && values.items.length > 0;

  const [step, setStep] = React.useState(stepOneCompleted ? STEPS.EXPENSE : STEPS.PAYEE);
  // Only true when logged in and drafting the expense
  const isOnBehalf = values.payee?.isInvite;

  // When user logs in we set its account as the default payout profile if not yet defined
  React.useEffect(() => {
    if (values?.draft?.payee && !loggedInAccount) {
      formik.setFieldValue('payee', {
        ...values.draft.payee,
        isInvite: false,
        isNewUser: true,
      });
    }
    // If creating a new expense or completing an expense submitted on your behalf, automatically select your default profile.
    else if (!isOnBehalf && (isDraft || !values.payee) && loggedInAccount && !isEmpty(payoutProfiles)) {
      formik.setFieldValue('payee', first(payoutProfiles));
    }
  }, [payoutProfiles, loggedInAccount]);

  // Pre-fill address based on the payout profile
  React.useEffect(() => {
    if (!values.payeeLocation?.address && values.payee?.location) {
      setLocationFromPayee(formik, values.payee);
    }
    if (!isDraft && values.payee?.isInvite) {
      setStep(STEPS.EXPENSE);
    }
  }, [values.payee]);

  // Return to Payee step if type is changed
  React.useEffect(() => {
    setStep(STEPS.PAYEE);
    if (!isDraft && values.payee?.isInvite) {
      formik.setFieldValue('payee', null);
    }
  }, [values.type]);

  // Load values from localstorage
  React.useEffect(() => {
    if (shouldLoadValuesFromPersister && formPersister && !dirty) {
      const formValues = formPersister.loadValues();
      if (formValues) {
        // Reset payoutMethod if host is no longer connected to TransferWise
        if (formValues.payoutMethod?.type === PayoutMethodType.BANK_ACCOUNT && !collective.host?.transferwise) {
          formValues.payoutMethod = undefined;
        }
        setValues(
          omit(
            formValues,
            // Omit deprecated fields, otherwise it will prevent expense submission
            ['location', 'privateInfo'],
          ),
        );
      }
    }
  }, [formPersister, dirty]);

  // Save values in localstorage
  React.useEffect(() => {
    if (dirty && formPersister) {
      formPersister.saveValues(values);
    }
  }, [formPersister, dirty, values]);

  return (
    <Form>
      <ExpenseTypeRadioSelect
        name="type"
        onChange={e => {
          handleChange(e);
        }}
        value={values.type}
        options={{
          fundingRequest:
            [CollectiveType.FUND, CollectiveType.PROJECT].includes(collective.type) ||
            collective.settings?.fundingRequest === true ||
            collective.host?.settings?.fundingRequest === true,
        }}
      />
      {values.type && (
        <StyledCard mt={4} p={[16, 16, 32]} overflow="initial">
          <HiddenFragment show={step == STEPS.PAYEE}>
            <Flex alignItems="center" mb={16}>
              <Span color="black.900" fontSize="16px" lineHeight="21px" fontWeight="bold">
                {formatMessage(msg.stepPayee)}
              </Span>
              <Box ml={2}>
                <PrivateInfoIcon size={12} color="#969BA3" tooltipProps={{ display: 'flex' }} />
              </Box>
              <StyledHr flex="1" borderColor="black.300" mx={2} />
            </Flex>
            {loading ? (
              <LoadingPlaceholder height={32} />
            ) : isDraft && !loggedInAccount ? (
              <ExpenseFormPayeeSignUpStep
                collective={collective}
                formik={formik}
                onCancel={onCancel}
                onNext={() => setStep(STEPS.EXPENSE)}
                payoutProfiles={payoutProfiles}
              />
            ) : (
              <ExpenseFormPayeeStep
                collective={collective}
                formik={formik}
                isOnBehalf={isOnBehalf}
                onCancel={onCancel}
                payoutProfiles={payoutProfiles}
                loggedInAccount={loggedInAccount}
                onNext={() => {
                  const validation = validatePayoutMethod(values.payoutMethod);
                  if (isEmpty(validation)) {
                    setStep(STEPS.EXPENSE);
                  } else {
                    setErrors({ payoutMethod: validation });
                  }
                }}
              />
            )}
          </HiddenFragment>

          <HiddenFragment show={step == STEPS.EXPENSE}>
            <Flex alignItems="center" mb={10}>
              <P
                as="label"
                htmlFor="expense-description"
                color="black.900"
                fontSize="16px"
                lineHeight="24px"
                fontWeight="bold"
              >
                {values.type === expenseTypes.FUNDING_REQUEST ? (
                  <FormattedMessage
                    id="Expense.EnterRequestSubject"
                    defaultMessage="Enter grant subject <small>(Public)</small>"
                    values={{
                      small(msg) {
                        return (
                          <Span fontWeight="normal" color="black.600">
                            {msg}
                          </Span>
                        );
                      },
                    }}
                  />
                ) : (
                  <FormattedMessage
                    id="Expense.EnterExpenseTitle"
                    defaultMessage="Enter expense title <small>(Public)</small>"
                    values={{
                      small(msg) {
                        return (
                          <Span fontWeight="normal" color="black.600">
                            {msg}
                          </Span>
                        );
                      },
                    }}
                  />
                )}
              </P>
              <StyledHr flex="1" borderColor="black.300" ml={2} />
            </Flex>
            <P fontSize="12px" color="black.600">
              <FormattedMessage
                id="Expense.PrivacyWarning"
                defaultMessage="This information is public. Do not put any private details in this field."
              />
            </P>
            <Field
              as={StyledInput}
              autoFocus={autoFocusTitle}
              border="0"
              error={errors.description}
              fontSize="24px"
              id="expense-description"
              maxLength={255}
              mt={3}
              name="description"
              px={2}
              py={1}
              width="100%"
              withOutline
              placeholder={
                values.type === expenseTypes.FUNDING_REQUEST
                  ? formatMessage(msg.grantSubjectPlaceholder)
                  : formatMessage(msg.descriptionPlaceholder)
              }
            />
            <HiddenFragment show={hasBaseFormFieldsCompleted}>
              <Flex alignItems="flex-start" mt={3}>
                <ExpenseTypeTag type={values.type} mr="4px" />
                <StyledInputTags
                  renderUpdatedTags
                  suggestedTags={expensesTags}
                  onChange={tags =>
                    formik.setFieldValue(
                      'tags',
                      tags.map(t => t.value.toLowerCase()),
                    )
                  }
                  value={values.tags}
                />
              </Flex>
              {values.type === expenseTypes.INVOICE && (
                <Box my={40}>
                  <ExpenseAttachedFilesForm
                    title={<FormattedMessage id="UploadInvoice" defaultMessage="Upload invoice" />}
                    description={
                      <FormattedMessage
                        id="UploadInvoiceDescription"
                        defaultMessage="If you already have an invoice document, you can upload it here."
                      />
                    }
                    onChange={files => formik.setFieldValue('attachedFiles', files)}
                    defaultValue={values.attachedFiles}
                  />
                </Box>
              )}

              <Flex alignItems="center" my={24}>
                <Span color="black.900" fontSize="16px" lineHeight="21px" fontWeight="bold">
                  {formatMessage(
                    isReceipt ? msg.stepReceipt : isFundingRequest ? msg.stepFundingRequest : msg.stepInvoice,
                  )}
                </Span>
                <StyledHr flex="1" borderColor="black.300" mx={2} />
                <StyledButton
                  buttonSize="tiny"
                  type="button"
                  onClick={() => addNewExpenseItem(formik)}
                  minWidth={135}
                  data-cy="expense-add-item-btn"
                >
                  +&nbsp;
                  {formatMessage(
                    isReceipt ? msg.addNewReceipt : isFundingRequest ? msg.addNewGrantItem : msg.addNewItem,
                  )}
                </StyledButton>
              </Flex>
              <Box>
                <FieldArray name="items" component={ExpenseFormItems} />
              </Box>

              {values.type === expenseTypes.FUNDING_REQUEST && (
                <Box my={40}>
                  <ExpenseAttachedFilesForm
                    title={<FormattedMessage id="UploadDocumentation" defaultMessage="Upload documentation" />}
                    description={
                      <FormattedMessage
                        id="UploadDocumentationDescription"
                        defaultMessage="If you want to include any documentation, you can upload it here."
                      />
                    }
                    onChange={files => formik.setFieldValue('attachedFiles', files)}
                    defaultValue={values.attachedFiles}
                  />
                </Box>
              )}

              <StyledHr flex="1" mt={4} borderColor="black.300" />
              <Flex mt={3} flexWrap="wrap" alignItems="center">
                <StyledButton
                  type="button"
                  width={['100%', 'auto']}
                  mx={[2, 0]}
                  mr={[null, 3]}
                  mt={2}
                  whiteSpace="nowrap"
                  data-cy="expense-back"
                  onClick={() => {
                    setStep(STEPS.PAYEE);
                    if (values.payee?.isInvite) {
                      formik.setFieldValue('payee', null);
                    }
                  }}
                >
                  ←&nbsp;
                  <FormattedMessage id="Back" defaultMessage="Back" />
                </StyledButton>
                <StyledButton
                  type="submit"
                  width={['100%', 'auto']}
                  mx={[2, 0]}
                  mr={[null, 3]}
                  mt={2}
                  whiteSpace="nowrap"
                  data-cy="expense-summary-btn"
                  buttonStyle="primary"
                  disabled={!stepTwoCompleted || !formik.isValid}
                  loading={formik.isSubmitting}
                >
                  {isInvite && !isDraft ? (
                    <FormattedMessage id="Expense.SendInvite" defaultMessage="Send Invite" />
                  ) : (
                    <FormattedMessage id="Pagination.Next" defaultMessage="Next" />
                  )}
                  &nbsp;→
                </StyledButton>
                {errors.payoutMethod?.data?.currency && touched.items?.some?.(i => i.amount) && (
                  <Box mx={[2, 0]} mt={2} color="red.500" fontSize="12px" letterSpacing={0}>
                    {errors.payoutMethod.data.currency.toString()}
                  </Box>
                )}
              </Flex>
            </HiddenFragment>
          </HiddenFragment>
        </StyledCard>
      )}

      {isInvite && !isDraft && (
        <Box>
          <Field name="recipientNote">
            {({ field }) => (
              <StyledInputField
                name={field.name}
                label={formatMessage(msg.recipientNoteLabel)}
                labelFontSize="13px"
                required={false}
                mt={3}
              >
                {inputProps => <Field as={StyledTextarea} {...inputProps} {...field} minHeight={80} />}
              </StyledInputField>
            )}
          </Field>
        </Box>
      )}

      {step == STEPS.EXPENSE && (
        <StyledCard mt={4} p={[16, 24, 32]} overflow="initial">
          <ExpensePayeeDetails expense={formik.values} host={collective.host} borderless collective={collective} />
        </StyledCard>
      )}
    </Form>
  );
};

ExpenseFormBody.propTypes = {
  formik: PropTypes.object,
  payoutProfiles: PropTypes.array,
  autoFocusTitle: PropTypes.bool,
  shouldLoadValuesFromPersister: PropTypes.bool,
  onCancel: PropTypes.func,
  formPersister: PropTypes.object,
  loggedInAccount: PropTypes.object,
  loading: PropTypes.bool,
  isDraft: PropTypes.bool,
  expensesTags: PropTypes.arrayOf(PropTypes.string),
  collective: PropTypes.shape({
    slug: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    host: PropTypes.shape({
      transferwise: PropTypes.shape({
        availableCurrencies: PropTypes.arrayOf(PropTypes.object),
      }),
    }),
    settings: PropTypes.object,
    isApproved: PropTypes.bool,
  }).isRequired,
};

/**
 * Main create expense form
 */
const ExpenseForm = ({
  onSubmit,
  collective,
  expense,
  payoutProfiles,
  autoFocusTitle,
  onCancel,
  validateOnChange,
  formPersister,
  loggedInAccount,
  loading,
  expensesTags,
  shouldLoadValuesFromPersister,
}) => {
  const isDraft = expense?.status === expenseStatus.DRAFT;
  const [hasValidate, setValidate] = React.useState(validateOnChange && !isDraft);
  const initialValues = { ...getDefaultExpense(collective), ...expense };
  if (isDraft) {
    initialValues.items = expense.draft.items;
    initialValues.attachedFiles = expense.draft.attachedFiles;
  }

  return (
    <Formik
      initialValues={initialValues}
      validate={hasValidate && validate}
      onSubmit={async (values, formik) => {
        // We initially let the browser do the validation. Then once users try to submit the
        // form at least once, we validate on each change to make sure they fix all the errors.
        const errors = validate(values);
        if (!isEmpty(errors)) {
          setValidate(true);
          formik.setErrors(errors);
        } else {
          return onSubmit(values);
        }
      }}
    >
      {formik => (
        <ExpenseFormBody
          formik={formik}
          payoutProfiles={payoutProfiles}
          collective={collective}
          autoFocusTitle={autoFocusTitle}
          onCancel={onCancel}
          formPersister={formPersister}
          loggedInAccount={loggedInAccount}
          expensesTags={expensesTags}
          loading={loading}
          shouldLoadValuesFromPersister={shouldLoadValuesFromPersister}
          isDraft={isDraft}
        />
      )}
    </Formik>
  );
};

ExpenseForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  autoFocusTitle: PropTypes.bool,
  validateOnChange: PropTypes.bool,
  shouldLoadValuesFromPersister: PropTypes.bool,
  onCancel: PropTypes.func,
  /** To save draft of form values */
  formPersister: PropTypes.object,
  loggedInAccount: PropTypes.object,
  loading: PropTypes.bool,
  expensesTags: PropTypes.arrayOf(PropTypes.string),
  collective: PropTypes.shape({
    currency: PropTypes.string.isRequired,
    slug: PropTypes.string.isRequired,
    host: PropTypes.shape({
      slug: PropTypes.string.isRequired,
      transferwise: PropTypes.shape({
        availableCurrencies: PropTypes.arrayOf(PropTypes.object),
      }),
    }),
    settings: PropTypes.object,
    isApproved: PropTypes.bool,
  }).isRequired,
  /** If editing */
  expense: PropTypes.shape({
    type: PropTypes.oneOf(Object.values(expenseTypes)),
    description: PropTypes.string,
    status: PropTypes.string,
    payee: PropTypes.object,
    draft: PropTypes.object,
    items: PropTypes.arrayOf(
      PropTypes.shape({
        url: PropTypes.string,
      }),
    ),
  }),
  /** Payout profiles that user has access to */
  payoutProfiles: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      slug: PropTypes.string,
      location: PropTypes.shape({
        address: PropTypes.string,
        country: PropTypes.string,
      }),
      payoutMethods: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string,
          type: PropTypes.oneOf(Object.values(PayoutMethodType)),
          name: PropTypes.string,
          data: PropTypes.object,
        }),
      ),
    }),
  ),
};

ExpenseForm.defaultProps = {
  validateOnChange: false,
};

export default React.memo(ExpenseForm);
