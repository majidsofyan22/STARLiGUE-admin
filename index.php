<?php

$host = "localhost";
$username = "root";
$password = "";
$dbname = "test";

$connect_database = mysqli_connect( $host, $username, $password, $dbname );

if(mysqli_connect_errno()){

    echo "not connected - غير متصل";
    exit();
}

else{
    echo "connected - متصل";
}




?>