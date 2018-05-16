import React from 'react';
import { withFormik, Field } from 'formik';
import { compose } from 'recompose';

const enhance = compose(
  withFormik({
    mapPropsToValues: ({ dataTypes }) => ({
      query: '',
      type: '',
      id: '',
      accessor: '',
    }),
    handleSubmit: async (values, { props: { addColumn }, setSubmitting }) => {
      await addColumn({ ...values, id: values.field });
      setSubmitting(false);
    },
  }),
);
const AddCustomColumn = ({ values, submitForm, style }) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        margin: 20,
        ...style,
      }}
    >
      <Field name="field" placeholder="field" value={values.field} />
      <Field name="type" placeholder="type" value={values.type} />
      <Field name="query" placeholder="query" value={values.query} />
      <Field name="accessor" placeholder="accessor" value={values.accessor} />
      <label>
        show:
        <Field type="checkbox" value={values.show} name="show" />
      </label>
      <label>
        active:
        <Field
          type="checkbox"
          value={values.canChangeShow}
          name="canChangeShow"
        />
      </label>
      <button onClick={submitForm}>Add Custom Column</button>
    </div>
  );
};

export default enhance(AddCustomColumn);
