import { useEffect, useRef, useCallback } from 'react';

const useCommunicator = (onMessage) => {
  const pollTimeoutRef = useRef(null);
  const onMessageRef = useRef(onMessage);

  // Update the ref whenever onMessage changes
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    // Poll for messages via HTTP
    const pollMessages = async () => {
      try {
        const response = await fetch('http://localhost:5174/api/messages', {
          method: 'GET',
        });
        if (response.ok) {
          const data = await response.json();
          if (data.messages && Array.isArray(data.messages)) {
            for (const message of data.messages) {
              if (onMessageRef.current) {
                onMessageRef.current(message);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to poll messages:', error);
      }
    };

    // Start polling
    console.log('Starting HTTP polling for messages');
    pollMessages();
    
    pollTimeoutRef.current = setInterval(pollMessages, 2000);

    return () => {
      if (pollTimeoutRef.current) {
        clearInterval(pollTimeoutRef.current);
      }
    };
  }, []);

  const send = useCallback(
    (message) => {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      console.log('Sending message:', payload);
      
      fetch('http://localhost:5174/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: typeof message === 'string' ? JSON.stringify({ text: message }) : JSON.stringify(message),
      }).catch(error => console.error('Failed to send message:', error));
    },
    []
  );

  return {
    send,
    isConnected: true
  };
};

export default useCommunicator;
