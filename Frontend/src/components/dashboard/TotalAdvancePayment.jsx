import {
  Banknote,
} from 'lucide-react';


export function TotalAdvancePayment({
  amount = 0,
  loading = false,
}) {

  const formatCurrency = (value) => {

    return Number(
      value || 0
    ).toLocaleString(
      'en-IN'
    );

  };


  return (

    <div
      className="
        bg-white
        border
        border-navy-100
        rounded-xl
        p-5
        shadow-sm
        flex
        items-center
        justify-between
      "
    >

      <div>

        <p
          className="
            text-sm
            text-navy-500
            mb-1
          "
        >
          Total Advance Payment
        </p>


        <h2
          className="
            text-2xl
            font-bold
            text-navy-900
          "
        >

          {loading
            ? 'Loading...'
            : `₹${formatCurrency(amount)}`
          }

        </h2>


        <p
          className="
            text-xs
            text-navy-400
            mt-1
          "
        >
          Total employee advances
        </p>

      </div>


      <div
        className="
          w-12
          h-12
          rounded-xl
          bg-navy-100
          flex
          items-center
          justify-center
        "
      >

        <Banknote
          size={24}
          className="text-navy-600"
        />

      </div>

    </div>

  );

}