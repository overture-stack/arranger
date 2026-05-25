#!/bin/sh
n=0
max_iter=5
until [ $n -ge ${max_iter} ]
do
   eval $1 && exit 0
   n=$((n+1))
   echo "Retrying ($n/${max_iter}): sleeping for 10 seconds..."
   sleep 10
done

echo "Command failed after ${max_iter} attempts"
exit 1