import React from 'react';
import { Navigate } from 'react-router-dom';
import AuthForm from '../components/AuthForm.jsx';
import { useAuth } from '../hooks/useAuth.js';

const SignupPage = () => {
  const { isAuthenticated, user } = useAuth();

  if (isAuthenticated) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  return <AuthForm mode="signup" />;
};

export default SignupPage;
