"""Stable launch APIs for the lab's desktop demonstrations.

The destination is fixed: caller input must never turn this into an open redirect.
Application authentication remains owned by each demonstration.
"""

from flask import Blueprint, redirect

demos_bp = Blueprint('demos', __name__)


@demos_bp.get('/demos/investment/launch')
def investment_launch():
    response = redirect('/projects/investment/', code=302)
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Robots-Tag'] = 'noindex, nofollow'
    response.headers['Referrer-Policy'] = 'no-referrer'
    return response


@demos_bp.get('/demos/airi/launch')
def airi_launch():
    response = redirect('/projects/airi/', code=302)
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Robots-Tag'] = 'noindex, nofollow'
    response.headers['Referrer-Policy'] = 'no-referrer'
    return response
