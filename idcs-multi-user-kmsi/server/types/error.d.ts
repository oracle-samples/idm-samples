interface AuthenticationErrorResponse{
  errorMessage:string;
  loginImpossible:boolean;
}

interface ErrorResponse {
  code:string;
  message:string;
}

export {AuthenticationErrorResponse, ErrorResponse};