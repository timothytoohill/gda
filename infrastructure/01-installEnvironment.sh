#!/bin/bash

#fail all if one fails
set -e

echo "Installing environment..."
scriptPath=$(realpath "$0")
scriptDirRelative=$(dirname "$scriptPath")
pushd "$scriptDirRelative"
scriptDir=$(pwd) #need absolute path for service file
popd

echo "Installing necessary packages..."   
yum install -y epel-release
yum install -y openssl
yum install -y htop
yum install -y openssl-devel 
yum install -y openssl11
yum install -y openssl11-devel
yum install -y bzip2-devel 
yum install -y libffi-devel
yum install -y wget
yum install -y libgit2
yum install -y libgit2-devel
yum install -y postgresql-devel
yum groupinstall -y "Development Tools"
echo "Done installing necessary packages."

echo "Installing Python 3.10 and pip..."
wget https://www.python.org/ftp/python/3.10.2/Python-3.10.2.tgz
tar xvf Python-3.10.2.tgz
mkdir -p /usr/local/openssl11
pushd /usr/local/openssl11
ln -s /usr/lib64/openssl11 lib
ln -s /usr/include/openssl11 include
popd
pushd Python-3.10.2
./configure --with-openssl=/usr/local/openssl11 --enable-optimizations
make install
popd
wget https://bootstrap.pypa.io/get-pip.py
python3 get-pip.py
python3 -V
pip3 -V
echo "Done installing Python 3.10 and pip."

echo "Running update..."
yum update -y
echo "Done running update."

echo "Installing libraries..."
pip3 install -r $scriptDir/requirements.txt
echo "Done installing libraries."

echo "Environment installed."