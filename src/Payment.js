import React, {useEffect, useState} from 'react'
import './Payment.css'
import { useStateValue } from './StateProvider';
import CheckoutProduct from './CheckoutProduct';
import { Link } from 'react-router-dom';
import { CardElement, useStripe, useElements} from "@stripe/react-stripe-js";
import CurrencyFormat from 'react-currency-format'
import { getBasketTotal } from './reducer.js';
import axios from './axios';
import {db} from './firebase'
import {collection} from 'firebase/firestore'
function Payment() {

    const [{basket, user}, dispatch] = useStateValue();

    const stripe = useStripe();
    const elements = useElements();

    const collectionRef = collection(db, 'users');

    const [error, setError] = useState(null);
    const [disabled, setDisabled] = useState(true);
    const [processing, setProcessing] = useState("");
    const [succeeded, setSucceeded] = useState(false);
    const [clientSecret, setClientSecret] = useState(true);

    useEffect(() => {
        // generate the special stripe secret which allows us to charge a customer
        const getClientSecret = async () => {
            const response = await axios({
                method: 'post',
                // Stripe expects the total in a currencies subunits
                url: `/payments/create?total=${getBasketTotal(basket) * 100}`
            })
            setClientSecret(response.data.clientSecret)
        }

        getClientSecret();
    }, [basket])

    const handleChange = (event) => {
        console.log(event)
        setDisabled(event.empty);
        setError(event.error ? event.error.message: null);
    }

    const handleSubmit = async (event) => {
        event.preventDefault();
        setProcessing(true);

        const payload  = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: elements.getElement(CardElement)
            }
        }).then(({ paymentIntent }) => {
            
            const addDataToFirebase = async () => {
               
               await db
                .collection('users')
                .doc(user?.uid)
                .collection('orders')
                .doc(paymentIntent?.id)
                .set({
                    basket: basket,
                    amount: paymentIntent.amount,
                    created: paymentIntent.created
                }).then((docRef) => {
                     // paymentIntent = payment confirmation
                    setSucceeded(true);
                    setError(null);
                    setProcessing(false);

                    dispatch({
                        type: "EMPTY_BASKET"
                    });

                    window.location.replace('/orders')
                })
                .catch((error) => {
                    console.error("Error adding document: ", error);
                });
            }

            addDataToFirebase();

        })
    }

  return (
    <div className='payment'>
        <div className='payment_container'>
             <h1>Checkout (
                <Link to="/checkout">{basket?.length} items</Link>)
            </h1>
            <div className='payment_section'>
                
                <div className='payment_title'>
                    <h3>Delivery Address</h3>
                </div>
                
                <div className='payment_address'>
                    <p>{user?.email}</p>
                </div>

            </div>

            <div className='payment_section'>
                
                <div className='payment_title'>
                    <h3>Review items and delivery</h3>
                </div>

                <div className='payment_items'>
                    {basket.map(item => (
                        <CheckoutProduct 
                            id={item.id}
                            title={item.title}
                            price={item.price}
                            rating={item.rating}
                            image={item.image}
                        />
                    ))}
                </div>

            </div>

            <div className='payment_section'>
                <div className='payment_title'>
                    <h3>Payment Method</h3>
                </div>
                <div className='payment_details'>
                    <form onSubmit={handleSubmit}>
                        
                        <CardElement onChange={handleChange}/>

                        <div className='payment_price_container'>
                            <CurrencyFormat 
                                renderText={(value) => (
                                    <h3>Order total: {value}</h3>
                                )}
                                decimalScale={2}
                                value={getBasketTotal(basket)}
                                displayType='text'
                                thousandSeparator={true}
                                prefix='$'
                            />
                            {console.log(processing || disabled || succeeded)}
                            <button>
                                    <span>{processing ? <p>Processing</p>: "Buy Now"}</span>
                            </button>
                        </div>

                        {error && <div>{error}</div>}

                    </form>
                </div>
            </div>
            
        </div>
    </div>
  )
}

export default Payment