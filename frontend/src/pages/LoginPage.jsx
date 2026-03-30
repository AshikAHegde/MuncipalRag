import React from 'react';
import { Navigate } from 'react-router-dom';
import AuthForm from '../components/AuthForm.jsx';
import { useAuth } from '../hooks/useAuth.js';

const LoginPage = () => {
  const { isAuthenticated, user } = useAuth();

  if (isAuthenticated) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  return <AuthForm mode="login" />;
};

export default LoginPage;
