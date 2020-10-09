#!/bin/bash
n=0
max_iter=15
until [ $n -ge ${max_iter} ]
do
   #$@ && break  # substitute your command here
   eval $1 && break
   n=$[$n+1]
   echo "Retrying ($n/${max_iter}): sleeping for 15 ..."
   sleep 15
done
