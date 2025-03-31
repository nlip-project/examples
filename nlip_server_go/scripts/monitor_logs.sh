#!/bin/bash

# Monitor both output and error logs in real-time
tail -f /var/log/nlip_output.log /var/log/nlip_error.log
