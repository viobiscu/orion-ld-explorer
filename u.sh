kubectl create configmap nginx-index \
  --from-file=index.html=index.html \
  --namespace=default \
  -o yaml --dry-run=client | kubectl apply -f -
  
  kubectl rollout restart deployment nginx-web
